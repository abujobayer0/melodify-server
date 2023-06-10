const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const { reset } = require("nodemon");
require("dotenv").config();

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
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
      console.log(user);
    });
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/user/selectedClass", async (req, res) => {
      const email = req.query.email;
      const selection = await selectCollection.find({ email: email }).toArray();
      res.send(selection);
    });
    app.get("/selectedClass/count", async (req, res) => {
      const email = req.query.email;
      const count = (await selectCollection.find({ email: email }).toArray())
        .length;
      res.status(200).send({ count });
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
      console.log({ selectedClass: classItem._id });
    });
    app.delete("/user/selectedClass/:id", async (req, res) => {
      const { id } = req.params;
      console.log(id);
      const result = await selectCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
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
    app.get("/all/classes/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const intId = parseInt(id);
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.find(query).toArray();
      res.send(result);
      console.log(result);
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
      console.log(newClass);
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
    app.put("/classes/status", async (req, res) => {
      const id = req.query.id;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.updateOne(query, {
        $set: {
          "newClass.status": status,
        },
      });
      console.log(id, status);
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
      console.log(id, status);
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
      console.log(id, feedback);
      res.send(result);
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
    <title>Hello from Render!</title>
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
