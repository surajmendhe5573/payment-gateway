const express = require('express');
const app= express();
const router = express.Router();
const paypal = require('@paypal/checkout-server-sdk');

const port= 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// PayPal environment setup
const environment = new paypal.core.SandboxEnvironment('AZYYxazJc8e7bJJi6R-jGn9654xw0zYutug3iUDZIzTKWmFEmcnkScFLW_abJari8extxdMWuOjJlS6i', 'EKeNzB-mE2aSSyuQQpzcSVhR4RMdTUNetYyAeqPS5CgHXpXZ-UfQPXHx48AnuPtqRaqE-qPkcbeIPdcz');
const client = new paypal.core.PayPalHttpClient(environment);

router.post('/initiate-payment', async (req, res) => {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { value: '499.00', currency_code: 'USD' } }],
        application_context: {
            return_url: "http://localhost:3000/success",
            cancel_url: "http://localhost:3000/cancel",
        },
    });

    try {
        const order = await client.execute(request);
        
        // Find the approval link
        const approvalLink = order.result.links.find(link => link.rel === 'approve');
        
        res.json({ 
            id: order.result.id, 
            approvalUrl: approvalLink.href  // Send the approval URL back to client
        });  
    } catch (error) {
        res.status(500).send(error);
    }
});


 // Capture Payment after Approval
router.post('/capture-payment/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    try {
        const capture = await client.execute(request);
        if (capture.result.status === "COMPLETED") {
            res.json({ status: "Payment captured successfully", capture });
        } else {
            res.json({ status: "Payment capture failed", capture });
        }
    } catch (error) {
        res.status(500).send(error);
    }
});

router.get('/verify-payment/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    const request = new paypal.orders.OrdersGetRequest(orderId);
    try {
        const order = await client.execute(request);
        if (order.result.status === "COMPLETED") {
            res.json({ status: "Payment successful" });
        } else {
            res.json({ status: "Payment not completed" });
        }
    } catch (error) {
        res.status(500).send(error);
    }
});

router.post('/process-refund', async (req, res) => {
    const captureId = req.body.captureId; // Capture ID from the completed transaction
    const request = new paypal.payments.CapturesRefundRequest(captureId);
    request.requestBody({ amount: { value: '10.00', currency_code: 'USD' } });
    try {
        const refund = await client.execute(request);
        res.json({ status: "Refund processed", refund });
    } catch (error) {
        res.status(500).send(error);
    }
});

// Success Route
router.get('/success', async (req, res) => {
    const { token } = req.query; // Get the token returned by PayPal
    const request = new paypal.orders.OrdersCaptureRequest(token); // Use the token to capture the order
    request.requestBody({});

    try {
        const capture = await client.execute(request);
        if (capture.result.status === "COMPLETED") {
            // Display payment details to the user
            res.send(`
                <h1>Payment Successful!</h1>
                <p>Transaction ID: ${capture.result.id}</p>
                <p>Amount: ${capture.result.purchase_units[0].payments.captures[0].amount.value} ${capture.result.purchase_units[0].payments.captures[0].amount.currency_code}</p>
                <p>Payer: ${capture.result.payer.name.given_name} ${capture.result.payer.name.surname}</p>
            `);
        } else {
            res.send("Payment not completed.");
        }
    } catch (error) {
        res.status(500).send(error);
    }
});


app.get('/success', (req, res) => {
    res.send("<h3>Your transaction was completed successfully !</h3>");
});

app.get('/cancel', (req, res) => {
    res.send("<h3>Payment was canceled.</h3>");
});


// Use the router
app.use('/', router);

app.listen(port, ()=>{
    console.log(`server is running on http://localhost:${port}`);
    
})
