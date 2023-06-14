const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);

const app = express();
const PORT = process.env.PORT || 7000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes

const uri = `mongodb+srv://${process.env.USER_NAME_DB}:${process.env.USER_PASS_DB}@cluster0.dfc18mn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const usersCollection = client.db("users-collection").collection("users");
    const classCollection = client.db("class-collection").collection("classes");
    const selectCollection = client
      .db("classes")
      .collection("selected-collection");
    const paymentHistoryCollection = client
      .db("payments")
      .collection("history");

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.put("/update/user", async (req, res) => {
      const email = req.query.email;
      const { name, address, number, gender } = req.body;
      console.log(name, address, number, gender);
      const query = { email: email };
      const result = await usersCollection.updateOne(query, {
        $set: {
          name: name,
          gender: gender,
          contactNumber: number,
          address: address,
        },
      });
      res.send(result);
    });
    app.put("/update/user/profile/image", async (req, res) => {
      const email = req.query.email;
      const { image } = req.body;

      const query = { email: email };
      const result = await usersCollection.updateOne(query, {
        $set: {
          image: image,
        },
      });
      res.send(result);
    });
    app.get("/user/selectedClass", async (req, res) => {
      const email = req.query.email;
      const selection = await selectCollection
        .find({ email: email, enroll: { $ne: true } })
        .toArray();
      res.send(selection);
    });

    app.get("/selectedClass/count", async (req, res) => {
      const email = req.query.email;
      const count = (
        await selectCollection
          .find({ email: email, enroll: { $ne: true } })
          .toArray()
      ).length;
      res.status(200).send({ count });
    });
    //create payment intend
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;
      const amount = price * 100;
      if (amount > 0) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } else {
        res.status(403).send({ message: "error" });
      }
    });
    app.post("/user/selectedClass", async (req, res) => {
      const { email, classItem } = req.body;
      const allSelectedCollection = await selectCollection.find().toArray();
      if (
        allSelectedCollection.find(
          (i) => i?.selectedClass?._id === classItem._id && i.email === email
        )
      ) {
        res.status(400).json({ error: "Class Already Selected" });
        return;
      }
      const collection = await selectCollection.insertOne({
        email: email,
        selectedClass: classItem,
      });
      res.send(collection);
    });
    app.delete("/user/selectedClass/:id", async (req, res) => {
      const { id } = req.params;

      const result = await selectCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    app.get("/user/selectedClass/:id/:email", async (req, res) => {
      const { id, email } = req.params;

      try {
        const result = await selectCollection.findOne({
          email: email,
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send("Error retrieving data");
      }
    });
    app.get("/enroll/totalLength", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { "newClass.email": email };
        const classItems = await classCollection.find(query).toArray();

        const totalLength = classItems.reduce(
          (total, item) => total + (item.newClass?.enroll?.length || 0),
          0
        );

        res.send({ totalLength });
      } catch (error) {
        console.error(error);
        res.status(500).send({
          error: "An error occurred while calculating total enroll length.",
        });
      }
    });

    app.put("/user/selectedClass/:id/:email", async (req, res) => {
      const { id, email } = req.params;

      try {
        const result = await selectCollection.updateOne(
          { _id: new ObjectId(id), email: email },
          {
            $set: {
              enroll: true,
            },
          }
        );

        res.send(result);
      } catch (error) {
        res.status(500).send("Error retrieving data");
      }
    });
    app.get("/userExists", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/user", async (req, res) => {
      const email = req.query.email;

      const result = await usersCollection.find({ email: email }).toArray();
      res.send(result);
    });
    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/instructor/classes", async (req, res) => {
      const email = req.query.email;
      const result = await classCollection
        .find({ "newClass.email": email })
        .toArray();
      res.send(result);
    });
    app.get("/popular-instructors", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/popular/instructors", async (req, res) => {
      try {
        const result = await classCollection
          .aggregate([
            {
              $group: {
                _id: "$newClass.instructor",
                totalEnrollments: {
                  $sum: {
                    $size: {
                      $ifNull: ["$newClass.enroll", []],
                    },
                  },
                },
                instructorImage: {
                  $first: "$newClass.instructorIcon",
                },
                instructorEmail: {
                  $first: "$newClass.email",
                },
                approvedCourseCount: {
                  $sum: {
                    $cond: [{ $eq: ["$newClass.status", "approved"] }, 1, 0],
                  },
                },
                emailCount: {
                  $sum: 1,
                },
              },
            },
            {
              $project: {
                _id: 0,
                instructor: "$_id",
                instructorImage: 1,
                instructorEmail: 1,
                totalEnrollments: 1,
                approvedCourseCount: 1,
                emailCount: 1,
              },
            },
          ])
          .toArray();
        const sortedResult = result.sort((a, b) => {
          const enrollA = a?.totalEnrollments || 0;
          const enrollB = b?.totalEnrollments || 0;

          return enrollB - enrollA;
        });
        res.json(sortedResult);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/popular/classes", async (req, res) => {
      const result = await classCollection
        .find({ "newClass.status": "approved" })
        .toArray();
      const sortedClasses = result.sort((a, b) => {
        const enrollA = a.newClass?.enroll?.length || 0;
        const enrollB = b.newClass?.enroll?.length || 0;

        return enrollB - enrollA;
      });
      res.send(sortedClasses.slice(0, 6));
    });
    app.get("/classes", async (req, res) => {
      const result = await classCollection
        .find({ "newClass.status": "approved" })
        .toArray();
      res.send(result);
    });
    app.get("/all/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    //Work
    app.get("/all/classes/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/admin/classes/instructors/users/count", async (req, res) => {
      const classCount = (await classCollection.find().toArray()).length;
      const userCount = (await usersCollection.find().toArray()).length;
      const instructorCount = (
        await usersCollection.find({ role: "instructor" }).toArray()
      ).length;
      res.send({ userCount, classCount, instructorCount });
    });
    app.post("/class", async (req, res) => {
      const newClass = req.body;
      const result = classCollection.insertOne(newClass);

      res.send(result);
    });

    app.put("/classes/update", async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const { available_seat, price, detail } = req.body;
      const result = await classCollection.updateOne(query, {
        $set: {
          "newClass.available_seat": available_seat,
          "newClass.price": price,
          "newClass.detail": detail,
        },
      });
      res.send(result);
    });
    app.put("/selected/enrolled/", async (req, res) => {
      const email = req.query.email;
      const id = req.query.id;

      const result = await selectCollection.updateOne(
        { _id: new ObjectId(id), email: email },
        {
          $set: {
            enroll: true,
          },
        }
      );

      res.send(result);
    });

    app.put("/classes/enroll/status", async (req, res) => {
      try {
        const id = req.query.id;
        const query = { _id: new ObjectId(id) };
        const email = req.query.email;

        const classDoc = await classCollection.findOne(query);

        if (!classDoc) {
          return res.status(404).send("Class not found");
        }

        const enrollEmails = classDoc.newClass.enroll || [];

        const availableSeats = classDoc.newClass.available_seat;
        if (availableSeats <= 0) {
          return res.status(400).send("No available seats");
        }

        enrollEmails.push(email);
        const updatedSeats = availableSeats - 1;

        const updateResult = await classCollection.updateOne(query, {
          $set: {
            "newClass.available_seat": updatedSeats,
            "newClass.enroll": enrollEmails,
          },
        });

        if (updateResult.modifiedCount !== 1) {
          return res.status(500).send("Failed to update class enrollment");
        }

        res.send({ result: updateResult });
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.put("/classes/status", async (req, res) => {
      const id = req.query.id;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.updateOne(query, {
        $set: {
          "newClass.status": status,
        },
      });

      res.send(result);
    });
    app.put("/users/role", async (req, res) => {
      const id = req.query.id;
      const status = req.body.role;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.updateOne(query, {
        $set: {
          role: status,
        },
      });

      res.send(result);
    });
    app.put("/classes/feedback", async (req, res) => {
      const id = req.query.id;
      const feedback = req.body.feedback;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.updateOne(query, {
        $set: {
          "newClass.feedback": feedback,
        },
      });

      res.send(result);
    });
    //payment history
    app.post("/payment/history", async (req, res) => {
      const payment = req.body;
      payment.timestamp = new Date();
      const result = await paymentHistoryCollection.insertOne(payment);
      res.send(result);
    });

    app.get("/payment/history", async (req, res) => {
      const email = req.query.email;
      const result = await paymentHistoryCollection
        .find({ "payment.email": email })
        .sort({ timestamp: -1 })
        .toArray();
      const count = result.length;
      res.send({ result, count });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.type("html").send(html);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Hello from Melodify!</title>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"></script>
    <script>
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          disableForReducedMotion: true
        });
      }, 500);
    </script>
    <style>
      @import url("https://p.typekit.net/p.css?s=1&k=vnd5zic&ht=tk&f=39475.39476.39477.39478.39479.39480.39481.39482&a=18673890&app=typekit&e=css");
      @font-face {
        font-family: "neo-sans";
        src: url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/l?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff2"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/d?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/a?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("opentype");
        font-style: normal;
        font-weight: 700;
      }
      html {
        font-family: neo-sans;
        font-weight: 700;
        font-size: calc(62rem / 16);
      }
      body {
        background: white;
      }
      section {
        border-radius: 1em;
        padding: 1em;
        position: absolute;
        top: 50%;
        left: 50%;
        margin-right: -50%;
        transform: translate(-50%, -50%);
      }
    </style>
  </head>
  <body>
    <section>
      Hello from Melodify Server!
    </section>
  </body>
</html>
`;
