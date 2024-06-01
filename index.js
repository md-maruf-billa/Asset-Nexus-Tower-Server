import express from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';
const app = express();
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const port = process.env.PORT || 7000;
const uri = `mongodb+srv://${process.env.DATABASE_USERNAMe}:${process.env.DATABASE_PASSWORD}@cluster0.fp7vkua.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// MIDDLEWARE
app.use(express.json());
app.use(cors())





// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // DATABASE COLLECTION
        const allUserCollection = client.db("ANT").collection("All-users");



        // MIDDLEWARE HARE

        // VERIFY VALID USER
        const verifyUser = (req, res, next) => {
            const token = req?.headers?.access_token;
            jwt.verify(token, process.env.USER_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            }
            )
        }


        // VERIFY ADMIN
        const verifyAdmin = (req, res, next) => {

        }

        // SAVE USER INFORMATION
        app.post("/user-info", async (req, res) => {
            const allInfo = req.body;
            const result = await allUserCollection.insertOne(allInfo);
            res.send(result);
        })
        // SEND USER DATA 
        app.get("/user-info/:email", async (req, res) => {
            const query = { email: req.params?.email };
            const result = await allUserCollection.findOne(query);
            res.send(result);
        })

        // SEND USER SECRET 
        app.post("/verify-user", async (req, res) => {
            const email = req.body;
            const token = jwt.sign(email, process.env.USER_SECRET, { expiresIn: "2h" });
            res.send({ token: token });
        })
        // VERIFY ADMIN ROLE
        app.get("/verify-role", verifyUser, async (req, res) => {
            const query = {email: req.decoded?.email};
            const result = await allUserCollection.findOne(query);
            res.send(result);
        })
        //-----TEST API
        app.get("/", (req, res) => {
            res.send("Server is running on the way.......")
        })
    } finally {

    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log("server is running......")
})

