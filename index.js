const express = require('express')
const {PrismaClient} = require('@prisma/client')
const db = new PrismaClient()
const crypto = require('crypto')

const app = express()
const port = process.env.PORT || 4000

// The home endpoint contains a form to receive the email address.
app.get('/', (req,res)=> {
    res.send(`
    <html lang="en">
    <body>
      <form method="POST" action="/auth/link">
        <p>Enter your email to login</p>
        <label>Email: <input type="email" name="email" required/></label>
        <button type="submit">Log in</button>
      </form>
    </body>
    </html>
  `);
})
// The first pipline use express native url encode
app.use(express.urlencoded({extended: true}))

// The second end point is for retrive the email in the database
app.post('/auth/link', async (req, res) => {
    
    // Retrieve the value of the email from the request object
  const email = req.body.email;
  console.log(email)

  // Find the user in database
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    // console.log('user not find')
    return res.sendStatus(404); // User not found!
}
// Generate a random token and generate one link to response user
const token = crypto.randomBytes(64).toString("hex");
const link = `${
  req.protocol + "://" + req.get("host")
}/auth/login?token=${token}`;
  
// The validity limit for 15 minutes
const validUntil = new Date(Date.now() + 15 * 60 * 1000); 

// Save the token in the database
await db.magicLink.create({
  data: {
    userId: user.id,
    token,
    validUntil,
  },
});

// Send the link by email
sendEmail(email, link);

// Done! send the response with data to the user
res.redirect(`/auth/link/sent?email=${email}`);
})

function sendEmail(to, body) {
  console.log(to, body);
}

// This pipline is for link sent the email 
app.get("/auth/link/sent", (req, res) => {
  const email = req.query.email;

  res.send(`
  <html lang="en">
  <body>
    <p>Link sent to <strong>${email}</strong>.</p>
  </body>
  </html>
  `);
});

app.get("/auth/login", async (req, res) => {
  // Retrieve the token from the query string of the request
  const token = req.query.token;
  if (!token) {
    console.log('token no exist')
    return res.sendStatus(400);
  }

  // Validate the token
  const magicLink = await db.magicLink.findFirst({
    // where: { token, isUsed: true,  validUntil: { gte: new Date() } },
    where: { token, validUntil: { gte: new Date() } },
  });
  if (!magicLink) {
    console.log('link error')
    return res.sendStatus(404);
  }

  // TODO: Mark the link as used, to avoid replay attacks
  await db.magicLink.update({
    // data: { isUsed: true },
    where: { id: magicLink.id },
    data: {} // UPDATE: without checking whether the link has been used or not
  });

  // Create a user session and redirect the user
  const user = await db.user.findUnique({ where: { id: magicLink.userId } });
  
  res.send({ user });
});

app.listen(port, ()=> {console.log(`I am listenning to port ${port}`)})