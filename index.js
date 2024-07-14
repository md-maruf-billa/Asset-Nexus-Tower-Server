import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
const app = express();
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import stripe from 'stripe';
const stripeKey = stripe(process.env.STRIPE_KEY)

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
        const allAssetsCollection = client.db("ANT").collection("all-assets");
        const allEmployeeCollection = client.db("ANT").collection("all-Employee");
        const allAssetsRequestCollection = client.db("ANT").collection("all-Assets-Request")


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
        const verifyAdmin = async (req, res, next) => {
            const email = { email: req?.decoded?.email };
            const result = await allUserCollection.findOne(email);
            if (result.userType == "HR Manager") {
                next();
            }
            else {
                res
                    .status(403)
                    .send("Unauthorize access")
            }
        }




        // ----------------ASSETS RELATED--------------------


        app.post("/add-asset", verifyUser, verifyAdmin, async (req, res) => {
            const assetInfo = req.body;
            const result = await allAssetsCollection.insertOne(assetInfo);
            res.send(result)

        })

        app.get("/all-asset-length/:email", verifyUser, async (req, res) => {
            const queryData = req.params.email;
            const query = { hrEmail: queryData };
            const result = await allAssetsCollection.find(query).toArray();
            res.send(result)
        })

        app.get("/all-asset/:email", verifyUser, async (req, res) => {
            const queryData = req.query;
            const email = req.params.email;
            const query = { hrEmail: email };
            const page = parseInt(queryData.page);
            const size = parseInt(queryData.size);
            

            try {
                let result = await allAssetsCollection.find(query)
                    .skip(page * size)
                    .limit(size)
                    .toArray();

                if (queryData.stock === "Out of Stock") {
                    result = result.filter(data => data.productQuantity === 0);
                } else if (queryData.stock === "In Stock") {
                    result = result.filter(data => data.productQuantity > 0);
                }

                if (queryData.sort === "Low to High") {
                    result.sort((a, b) => parseInt(a.productQuantity) - parseInt(b.productQuantity));
                } else if (queryData.sort === "High to Low") {
                    result.sort((a, b) => parseInt(b.productQuantity) - parseInt(a.productQuantity));
                }


                res.send(result);

            } catch (error) {
                console.error("Error fetching assets:", error);
                res.status(500).send("Internal Server Error");
            }
        });


        // DELETE A ASSET
        app.delete("/delete-asset/:id", verifyUser, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await allAssetsCollection.deleteOne(query);
            res.send(result)
        })

        // GET SINGLE ASSET BY ID
        app.get("/single-asset/:id", verifyUser, async (req, res) => {
            const id = req.params.id;
            if (id == "") return;
            const result = await allAssetsCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);

        })

        // UPDATE ASSET INFORMATION
        app.patch("/update-asset/:id", verifyUser, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedData = req.body;
            // updated document
            const updatedDoc = {
                $set: {
                    productName: updatedData.productName,
                    productType: updatedData.productType,
                    productQuantity: updatedData.productQuantity,
                    assetImage: updatedData.assetImage
                }
            }

            const result = await allAssetsCollection.updateOne(query, updatedDoc);
            res.send(result)

        })


        // GET ALL COMPANY
        app.get("/all-company", async (req, res) => {
            const result = await allUserCollection.aggregate([
                {
                    $match: { userType: "HR Manager" }
                }
            ]).toArray();
            res.send(result);
        })


        // SAVE REQUEST DATA IN DATABASE
        app.post("/save-request-data", verifyUser, async (req, res) => {
            const requestInfo = req.body;
            const result = await allAssetsRequestCollection.insertOne(requestInfo);
            res.send(result);
        })

        // GET EMPLOYEE ASSET REQUEST DATA
        app.get("/employee-asset-request/:email", verifyUser, async (req, res) => {
            const query = { employeeEmail: req.params.email };
            const result = await allAssetsRequestCollection.find(query).toArray();
            res.send(result)
        })


        // GET ALL EMPLOYEE BY CURRENT HR EMAIL
        app.get("/current-hr-employee/:email", verifyUser, verifyAdmin, async (req, res) => {
            const hrEmail = req.params.email;
            const result = await allEmployeeCollection.aggregate([
                {
                    $match: {
                        hrEmail: hrEmail,
                        status: "Accepted"
                    }
                }
            ]).toArray();
            res.send(result)
        })
        // DELETE A EMPLOYEE BY HR MANAGER
        app.delete("/current-hr-employee/:email", verifyUser, verifyAdmin, async (req, res) => {
            const query = { employeeEmail: req.params.email };
            const result = await allEmployeeCollection.deleteOne(query);
            res.send(result)
        })


        // GET WHICH REQUEST WHICH HR CURRENTLY LOGIN
        app.get("/load-all-requested-length/:email", verifyUser, verifyAdmin, async (req, res) => {
            const query = { hrEmail: req.params.email };
            const result = await allAssetsRequestCollection.find(query).toArray();
            res.send(result);
        })
        // GET WHICH REQUEST WHICH HR CURRENTLY LOGIN
        app.get("/load-all-requested/:email", verifyUser, verifyAdmin, async (req, res) => {
            const query = { hrEmail: req.params.email };
            const prevPage = parseInt(req.query.page);
            const dataSize = parseInt(req.query.size);
            const result = await allAssetsRequestCollection.find(query)
            .skip(prevPage*dataSize)
            .limit(dataSize)
            .toArray();
            res.send(result);
        })

        // DELETE USER REQUEST------
        app.delete("/delete-asset-request",verifyUser ,async(req,res)=>{
            const id = req.query.id;
            const email = req.query.email;

            const query = {
                _id: new ObjectId(id),
                employeeEmail : email
            }
            const result = await allAssetsRequestCollection.deleteOne(query);
            res.send(result);
        })

        // loaded my team
        app.get("/loaded-my-team/:email", verifyUser, async (req, res) => {
            const query = { employeeEmail: req.params.email };
            const result = await allEmployeeCollection.findOne(query);
            const findQuery = { hrEmail: result.hrEmail };
            const allEmployee = await allEmployeeCollection.find(findQuery).toArray();

            res.send(allEmployee)
        })

        // my details
        app.get('/my-details/:email', verifyUser, async (req, res) => {
            const query = { employeeEmail: req.params.email };
            const result = await allEmployeeCollection.findOne(query);
            res.send(result)
        })

        // search hare---
        app.get("/search-data/:search", verifyUser, async (req, res) => {
            const searchValue = req.params.search;
            const email = req.query;
            if (searchValue === "") {
                return;
            }
            else {
                const result = await allAssetsCollection.aggregate([
                    {
                        $match: {
                            hrEmail: email.email,
                            $or: [
                                { productName: { $regex: searchValue, $options: "i" } },
                                { productType: { $regex: searchValue, $options: "i" } }
                            ]
                        }
                    }
                ]).toArray();

                res.send(result);
            }
        })
        // UPDATE CURRENT STATUS BY HR ROUTE USING ID
        app.patch("/update-request-status/:id", verifyUser, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const status = req.body;
            const updatedDoc = {

                $set: {
                    status: status.status,
                    acceptedDate: status.acceptedDate
                }
            }
            const options = { upsert: true }
            const result = await allAssetsRequestCollection.updateOne(query, updatedDoc, options);
            res.send(result);
        })

        //-----------------USER RELATED---------------------

        // SAVE USER INFORMATION
        app.post("/user-info", async (req, res) => {
            const allInfo = req.body;
            const result = await allUserCollection.insertOne(allInfo);
            res.send(result);
        })
        // SEND USER DATA 
        app.get("/user-info/:email", verifyUser, async (req, res) => {
            const query = { email: req.params?.email };
            const result = await allUserCollection.findOne(query);
            res.send(result);
        })
        // GET USER DATA BY ID
        app.get("/billing-user/:id", verifyUser, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allUserCollection.findOne(query);
            res.send(result)
        })

        // VERIFY EMPLOYEE
        app.get("/employee-info/:email", verifyUser, async (req, res) => {
            const email = req.params.email;
            const query = { employeeEmail: email };
            const result = await allEmployeeCollection.findOne(query);
            res.send(result);
        })
        // GET EMPLOYEE REQUEST
        app.get("/employee-request/:email", verifyUser, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const result = await allEmployeeCollection.aggregate([
                {
                    $match: {
                        hrEmail: email,
                        status: "Requested"
                    }
                }
            ]).toArray();
            res.send(result)
        })
        // UPDATE EMPLOYEE STATUS
        app.patch("/update-employee-status/:id", verifyUser, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateInfo = req.body;
            const updatedDoc = {
                $set: {
                    status: updateInfo.status
                }
            }
            const result = await allEmployeeCollection.updateOne(query, updatedDoc);
            res.send(result)
        })
        // SET A EMPLOYEE DATA UNDER A HR MANAGER
        app.post("/register-team", verifyUser, async (req, res) => {
            const allData = req.body;
            const result = await allEmployeeCollection.insertOne(allData);
            res.send(result)
        })

        // SEND USER SECRET 
        app.post("/verify-user", async (req, res) => {
            const email = req.body;
            const token = jwt.sign(email, process.env.USER_SECRET, { expiresIn: "2h" });
            res.send({ token: token });
        })
        // VERIFY ADMIN ROLE
        app.get("/verify-role", verifyUser, async (req, res) => {
            const query = { email: req.decoded?.email };
            const result = await allUserCollection.findOne(query);
            res.send(result);
        })
        // ADD SUBSCRIPTION ON A USER PROFILE
        app.patch("/add-subscription/:email", async (req, res) => {
            const userEmail = req.params.email;
            const query = { email: userEmail };
            const subscriptionInfo = req.body;
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    packageInfo: subscriptionInfo
                }
            }

            const result = await allUserCollection.updateOne(query, updatedDoc, options);
            res.send(result)
        })

        // -----CHECK PAYMENT INTENT-----
        app.post("/payment-intent", verifyUser, async (req, res) => {
            const price = parseInt(req.body?.price) * 100;
            const paymentIntent = await stripeKey.paymentIntents.create({
                amount: price,
                currency: "usd"
            })
            res.send(paymentIntent)
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

