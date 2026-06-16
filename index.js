const express = require("express");
const app = express();
const port = 5000;
const cors = require("cors");
require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const logger = (req, res, next) => {
  console.log("logger middleware logged", req.params);
  next();
};

// mongodb connection

const uri = process.env.MONGODB_URI;

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

    const database = client.db("hireloop-db");
    const jobCollection = database.collection("jobs");
    const companyCollection = database.collection("companies");
    const userCollection = database.collection("user");
    const applicationCollection = database.collection("applications");
    const planCollection = database.collection("plans");
    const subscriptionCollection = database.collection("subscriptions");
    const sessionCollection = database.collection("session");

    // verification related
    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const query = { token: token };
      const session = await sessionCollection.findOne(query);
      console.log(session);
      next();
    };

    // user
    // get user
    app.get("/api/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // subscription
    // post subscription
    app.post("/api/subscriptions", async (req, res) => {
      const data = req.body;
      console.log(data);
      const subsInfo = {
        ...data,
        createdAt: new Date(),
      };
      const result = await subscriptionCollection.insertOne(subsInfo);

      // update the user information
      const filter = { email: data.email };
      const updateDocument = {
        $set: {
          plan: data.planId,
        },
      };
      const updateResult = await userCollection.updateOne(
        filter,
        updateDocument,
      );
      res.send(updateResult);
    });

    // plans
    // get plans
    app.get("/api/plans", async (req, res) => {
      const query = {};
      if (req.query.plan_id) {
        query.id = req.query.plan_id;
      }
      const plan = await planCollection.findOne(query);
      res.send(plan);
    });

    // job applications
    // job applications get
    app.get("/api/applications", async (req, res) => {
      const query = {};
      if (req.query.applicantId) {
        query.applicantId = req.query.applicantId;
      }
      if (req.query.jobId) {
        query.jobId = req.query.jobId;
      }
      const cursor = applicationCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // job applications post
    app.post("/api/applications", async (req, res) => {
      const application = req.body;
      const newApplication = {
        ...application,
        createdAt: new Date(),
      };
      const result = await applicationCollection.insertOne(newApplication);
      res.send(result);
    });

    // companies related api
    // // get companies
    // app.get("/api/companies", async (req, res) => {
    //   const cursor = companyCollection.find();
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    // inefficient way to join/aggregate collection
    app.get("/api/companies", logger, verifyToken, async (req, res) => {
      const cursor = companyCollection.find();
      const companies = await cursor.toArray();
      for (const company of companies) {
        const filter = {
          companyId: company._id.toString(),
        };
        const jobCount = await jobCollection.countDocuments(filter);
        company.jobCount = jobCount;
      }
      res.send(companies);
    });

    // get companies
    app.get("/api/my/companies", async (req, res) => {
      const query = {};
      if (req.query.recruiterId) {
        query.recruiterId = req.query.recruiterId;
      }
      console.log(query);
      const result = await companyCollection.findOne(query);

      console.log(result, "result");
      res.send(result || {});
    });

    // post companies
    app.post("/api/companies", async (req, res) => {
      const company = req.body;
      const newCompany = {
        ...company,
        createdAt: new Date(),
      };
      const result = await companyCollection.insertOne(newCompany);
      res.send(result);
    });

    // patch companies
    app.patch("/api/companies/:id", logger, verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id, "approve id");
      const updatedCompany = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: updatedCompany.status,
        },
      };
      const result = await companyCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get jobs
    app.get("/api/jobs", async (req, res) => {
      const query = {};
      if (req.query.companyId) {
        query.companyId = await req.query.companyId;
      }
      if (req.query.status) {
        query.status = await req.query.status;
      }
      const cursor = await jobCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // dynamic job
    app.get("/api/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    // jobs post
    app.post("/api/jobs", async (req, res) => {
      const job = req.body;
      const newJob = {
        ...job,
        createdAt: new Date(),
      };
      const result = await jobCollection.insertOne(newJob);
      //   console.log(result);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
