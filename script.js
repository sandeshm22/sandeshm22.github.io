const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const razorpay = new Razorpay({
  key_id: "YOUR_KEY_ID",
  key_secret: "YOUR_KEY_SECRET"
});

app.post("/create-order", async (req, res) => {
  const { amount, customerEmail, customerName, customerPhone } = req.body;

  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: "receipt#1"
  };

  try {
    const order = await razorpay.orders.create(options);

    // Capture customer info (for demo, log it)
    console.log("New Order:", {
      orderId: order.id,
      email: customerEmail,
      name: customerName,
      phone: customerPhone,
      amount
    });

    // TODO: Save to database (MongoDB, MySQL, Firebase, etc.)
    res.json(order);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.listen(3000, () => console.log("Backend running on http://localhost:3000"));
