import fs from "fs";
import path from "path";
import crypto from "crypto";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  credits: number;
  createdAt: string;
  transactions: {
    id: string;
    type: "signup" | "generation" | "payment";
    amount: number;
    creditsBefore: number;
    creditsAfter: number;
    timestamp: string;
    referenceId?: string;
    status?: "pending" | "approved" | "rejected";
    currency?: string;
    amountPaid?: number;
  }[];
}

// Global Firestore database handle
let db: Firestore | null = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }
    db = getFirestore();
    console.log("Firebase Admin Firestore initialized successfully using custom credentials.");
  } else if (process.env.FIREBASE_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (getApps().length === 0) {
      initializeApp();
    }
    db = getFirestore();
    console.log("Firebase Admin Firestore initialized successfully using standard environmental credentials.");
  } else {
    console.log("No Firebase credentials detected. Operating on local file database.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin, falling back to local file storage:", error);
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "users.json");

// Ensure directory and file exist for local fallback
function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2), "utf8");
  }
}

// Read all users from local fallback
export function readUsers(): Record<string, User> {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data || "{}");
  } catch (err) {
    console.error("Error reading users database, resetting:", err);
    return {};
  }
}

// Write all users to local fallback
export function writeUsers(users: Record<string, User>) {
  initDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), "utf8");
}

// Helper to hash passwords simply
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return "h_" + hash.toString(36);
}

// Strong cryptographic SHA-256 hashing for passwords
export function secureHash(str: string): string {
  return crypto.createHash("sha256").update(str + "_vox_secure_salt_773").digest("hex");
}

const ENCRYPTION_ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = (() => {
  const secret = process.env.ENCRYPTION_SECRET || "a3ef82bc9942d991bfca8251e04130f8"; // fallback 32-char key
  return crypto.createHash("sha256").update(secret).digest();
})();

// Encrypt plain text using AES-256-CBC
export function encrypt(text: string): string {
  try {
    if (!text) return "";
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  } catch (err) {
    console.error("Encryption error:", err);
    return text;
  }
}

// Decrypt text back to plain text
export function decrypt(encryptedText: string): string {
  try {
    if (!encryptedText || !encryptedText.includes(":")) {
      return encryptedText; // backward compatibility for plain historical records
    }
    const parts = encryptedText.split(":");
    if (parts.length !== 2) return encryptedText;
    const [ivHex, encryptedHex] = parts;
    if (ivHex.length !== 32) {
      return encryptedText; // not a standard IV hex
    }
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return encryptedText; // safety fallback for non-encrypted strings
  }
}

// Decrypt all reference IDs in user transactions on the fly before sending to client
export function decryptUserTransactions(user: User): User {
  if (!user) return user;
  if (!user.transactions) {
    user.transactions = [];
    return user;
  }
  const decryptedTransactions = user.transactions.map((tx) => ({
    ...tx,
    referenceId: tx.referenceId ? decrypt(tx.referenceId) : tx.referenceId,
  }));
  return {
    ...user,
    transactions: decryptedTransactions,
  };
}

// List of typical temporary email domains to block
const tempMailDomains = new Set([
  "yopmail.com", "mailinator.com", "tempmail.com", "10minutemail.com",
  "guerrillamail.com", "dispostable.com", "getairmail.com", "throwawaymail.com",
  "temp-mail.org", "generator.email", "sharklasers.com", "guerrillamailblock.com",
  "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "tempmailaddress.com",
  "boun.cr", "mailnesia.com", "maildrop.cc", "discard.email", "spambox.us",
  "trashmail.com", "33mail.com", "anonbox.net", "duck.com", "tempmail.net",
  "moakt.com", "spymail.one", "tempmail.dev", "disposable.com", "disposablemail.com",
  "burnermail.io", "mailet.com", "10minutemail.co.uk", "tempmail.co",
  "crazymailing.com", "zillamail.com", "temp-mail.io", "inboxkitten.com"
]);

// Check if email is temporary
export function isTemporaryEmail(email: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  const parts = cleanEmail.split("@");
  if (parts.length !== 2) return true; // Invalid email format

  const domain = parts[1];
  
  // Check explicit set
  if (tempMailDomains.has(domain)) return true;

  // Check typical keywords in disposable emails
  const tempKeywords = [
    "temp", "tmp", "disposable", "throwaway", "mailinator", "yopmail", 
    "trashmail", "dropmail", "fake", "junk", "tempmail", "burner"
  ];
  
  return tempKeywords.some(keyword => domain.includes(keyword));
}

// Generate secure simple token
export function generateToken(user: User): string {
  return simpleHash(user.email + "_" + user.passwordHash);
}

// Find user by session token
export async function findUserByToken(tokenHeader: string | undefined): Promise<User | null> {
  if (!tokenHeader || !tokenHeader.startsWith("Bearer ")) return null;
  const actualToken = tokenHeader.substring(7);

  if (db) {
    try {
      const snapshot = await db.collection("vox_users").where("token", "==", actualToken).limit(1).get();
      if (!snapshot.empty) {
        return snapshot.docs[0].data() as User;
      }
    } catch (err) {
      console.error("Firestore findUserByToken failed, using local db fallback:", err);
    }
  }

  const users = readUsers();
  for (const email of Object.keys(users)) {
    const user = users[email];
    const expectedToken = generateToken(user);
    if (expectedToken === actualToken) {
      return user;
    }
  }
  return null;
}

// Register user
export async function registerUser(email: string, passwordPlain: string): Promise<{ user: User; token: string }> {
  const cleanEmail = email.trim().toLowerCase();
  
  if (isTemporaryEmail(cleanEmail)) {
    throw new Error("Temporary or disposable email addresses are not permitted. Please register with a standard email provider.");
  }

  const passwordHash = secureHash(passwordPlain);
  const newUser: User = {
    id: "usr_" + Math.random().toString(36).substring(2, 11),
    email: cleanEmail,
    passwordHash: passwordHash,
    credits: 20000, // 20k credits by default
    createdAt: new Date().toISOString(),
    transactions: [
      {
        id: "tx_" + Math.random().toString(36).substring(2, 11),
        type: "signup",
        amount: 20000,
        creditsBefore: 0,
        creditsAfter: 20000,
        timestamp: new Date().toISOString(),
        referenceId: "WELCOME_BONUS"
      }
    ]
  };
  const token = generateToken(newUser);

  if (db) {
    try {
      const userRef = db.collection("vox_users").doc(cleanEmail);
      const doc = await userRef.get();
      if (doc.exists) {
        throw new Error("An account with this email address already exists.");
      }
      
      const firestoreUser = { ...newUser, token };
      await userRef.set(firestoreUser);
      return { user: newUser, token };
    } catch (err: any) {
      if (err.message.includes("already exists")) throw err;
      console.error("Firestore registerUser failed, using local db fallback:", err);
    }
  }

  const users = readUsers();
  if (users[cleanEmail]) {
    throw new Error("An account with this email address already exists.");
  }

  users[cleanEmail] = newUser;
  writeUsers(users);

  return {
    user: newUser,
    token
  };
}

// Login user
export async function loginUser(email: string, passwordPlain: string): Promise<{ user: User; token: string }> {
  const cleanEmail = email.trim().toLowerCase();

  const hashSimple = simpleHash(passwordPlain);
  const hashSecure = secureHash(passwordPlain);

  if (db) {
    try {
      const userRef = db.collection("vox_users").doc(cleanEmail);
      const doc = await userRef.get();
      if (doc.exists) {
        const user = doc.data() as User;
        if (user.passwordHash === hashSecure || user.passwordHash === hashSimple) {
          if (user.passwordHash === hashSimple) {
            user.passwordHash = hashSecure;
            await userRef.update({ passwordHash: hashSecure });
          }
          const token = generateToken(user);
          return { user, token };
        } else {
          throw new Error("Invalid email or password combination.");
        }
      } else {
        throw new Error("Invalid email or password combination.");
      }
    } catch (err: any) {
      if (err.message.includes("Invalid email or password combination")) throw err;
      console.error("Firestore loginUser failed, using local db fallback:", err);
    }
  }

  const users = readUsers();
  const user = users[cleanEmail];

  if (!user) {
    throw new Error("Invalid email or password combination.");
  }

  if (user.passwordHash === hashSecure || user.passwordHash === hashSimple) {
    if (user.passwordHash === hashSimple) {
      user.passwordHash = hashSecure;
      users[cleanEmail] = user;
      writeUsers(users);
    }
    return {
      user,
      token: generateToken(user)
    };
  } else {
    throw new Error("Invalid email or password combination.");
  }
}

// Deduct credits for a generation (100 credits)
export async function deductCredits(email: string, amount: number = 100): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();

  if (db) {
    try {
      const userRef = db.collection("vox_users").doc(cleanEmail);
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        if (!doc.exists) {
          throw new Error("User session not found.");
        }
        const user = doc.data() as User;
        if (user.credits < amount) {
          throw new Error(`Insufficient credits. You need ${amount} credits to transcribe, but only have ${user.credits} remaining.`);
        }

        const creditsBefore = user.credits;
        user.credits -= amount;

        if (!user.transactions) user.transactions = [];
        user.transactions.unshift({
          id: "tx_" + Math.random().toString(36).substring(2, 11),
          type: "generation",
          amount: -amount,
          creditsBefore,
          creditsAfter: user.credits,
          timestamp: new Date().toISOString(),
          referenceId: "SRT_GENERATION"
        });

        const token = generateToken(user);
        transaction.update(userRef, {
          credits: user.credits,
          transactions: user.transactions,
          token
        });

        return user;
      });
      return result;
    } catch (err: any) {
      if (err.message.includes("Insufficient credits") || err.message.includes("not found")) throw err;
      console.error("Firestore deductCredits failed, using local db fallback:", err);
    }
  }

  const users = readUsers();
  const user = users[cleanEmail];

  if (!user) {
    throw new Error("User session not found.");
  }

  if (user.credits < amount) {
    throw new Error(`Insufficient credits. You need ${amount} credits to transcribe, but only have ${user.credits} remaining.`);
  }

  const creditsBefore = user.credits;
  user.credits -= amount;

  user.transactions.unshift({
    id: "tx_" + Math.random().toString(36).substring(2, 11),
    type: "generation",
    amount: -amount,
    creditsBefore,
    creditsAfter: user.credits,
    timestamp: new Date().toISOString(),
    referenceId: "SRT_GENERATION"
  });

  users[cleanEmail] = user;
  writeUsers(users);

  return user;
}

// Add credits after payment top-up (2000 credits)
export async function addCredits(email: string, amount: number = 2000, referenceId: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();

  if (db) {
    try {
      const userRef = db.collection("vox_users").doc(cleanEmail);
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        if (!doc.exists) {
          throw new Error("User session not found.");
        }
        const user = doc.data() as User;
        const creditsBefore = user.credits;
        user.credits += amount;

        if (!user.transactions) user.transactions = [];
        user.transactions.unshift({
          id: "tx_" + Math.random().toString(36).substring(2, 11),
          type: "payment",
          amount: amount,
          creditsBefore,
          creditsAfter: user.credits,
          timestamp: new Date().toISOString(),
          referenceId: encrypt(referenceId || "UPI_PAYMENT"),
          status: "approved"
        });

        const token = generateToken(user);
        transaction.update(userRef, {
          credits: user.credits,
          transactions: user.transactions,
          token
        });

        return user;
      });
      return result;
    } catch (err: any) {
      if (err.message.includes("not found")) throw err;
      console.error("Firestore addCredits failed, using local db fallback:", err);
    }
  }

  const users = readUsers();
  const user = users[cleanEmail];

  if (!user) {
    throw new Error("User session not found.");
  }

  const creditsBefore = user.credits;
  user.credits += amount;

  user.transactions.unshift({
    id: "tx_" + Math.random().toString(36).substring(2, 11),
    type: "payment",
    amount: amount,
    creditsBefore,
    creditsAfter: user.credits,
    timestamp: new Date().toISOString(),
    referenceId: encrypt(referenceId || "UPI_PAYMENT"),
    status: "approved"
  });

  users[cleanEmail] = user;
  writeUsers(users);

  return user;
}

// Submit payment for manual review instead of directly granting credits
export async function submitPaymentForReview(
  email: string,
  amount: number = 2000,
  referenceId: string,
  currency: string = "USD",
  amountPaid: number = 12
): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanRef = referenceId.trim();

  if (db) {
    try {
      // Check if referenceId was already used across all Firestore users
      const snapshot = await db.collection("vox_users").get();
      for (const doc of snapshot.docs) {
        const u = doc.data() as User;
        if (u.transactions) {
          for (const tx of u.transactions) {
            if (decrypt(tx.referenceId || "") === cleanRef && tx.type === "payment" && tx.status !== "rejected") {
              throw new Error("This payment transaction/UTR ID has already been submitted or processed.");
            }
          }
        }
      }

      const userRef = db.collection("vox_users").doc(cleanEmail);
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        if (!doc.exists) {
          throw new Error("User session not found.");
        }
        const user = doc.data() as User;
        if (!user.transactions) user.transactions = [];
        user.transactions.unshift({
          id: "tx_" + Math.random().toString(36).substring(2, 11),
          type: "payment",
          amount: amount,
          creditsBefore: user.credits,
          creditsAfter: user.credits, // Credits remain unchanged until approved
          timestamp: new Date().toISOString(),
          referenceId: encrypt(cleanRef),
          status: "pending",
          currency,
          amountPaid
        });

        const token = generateToken(user);
        transaction.update(userRef, {
          transactions: user.transactions,
          token
        });

        return user;
      });
      return result;
    } catch (err: any) {
      if (err.message.includes("already been submitted") || err.message.includes("not found")) throw err;
      console.error("Firestore submitPaymentForReview failed, using local db fallback:", err);
    }
  }

  const users = readUsers();
  const user = users[cleanEmail];

  if (!user) {
    throw new Error("User session not found.");
  }

  // Check if referenceId was already used
  for (const u of Object.values(users)) {
    for (const tx of u.transactions) {
      if (decrypt(tx.referenceId || "") === cleanRef && tx.type === "payment" && tx.status !== "rejected") {
        throw new Error("This payment transaction/UTR ID has already been submitted or processed.");
      }
    }
  }

  user.transactions.unshift({
    id: "tx_" + Math.random().toString(36).substring(2, 11),
    type: "payment",
    amount: amount,
    creditsBefore: user.credits,
    creditsAfter: user.credits, // Credits remain unchanged until approved
    timestamp: new Date().toISOString(),
    referenceId: encrypt(cleanRef),
    status: "pending",
    currency,
    amountPaid
  });

  users[cleanEmail] = user;
  writeUsers(users);

  return user;
}

// Approve a pending payment
export async function approvePayment(email: string, txId: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();

  if (db) {
    try {
      const userRef = db.collection("vox_users").doc(cleanEmail);
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        if (!doc.exists) {
          throw new Error("User not found.");
        }
        const user = doc.data() as User;
        const tx = user.transactions?.find(t => t.id === txId);
        if (!tx) {
          throw new Error("Transaction not found.");
        }
        if (tx.status !== "pending") {
          throw new Error(`Transaction is already ${tx.status}.`);
        }

        const creditsBefore = user.credits;
        user.credits += tx.amount;
        tx.status = "approved";
        tx.creditsBefore = creditsBefore;
        tx.creditsAfter = user.credits;
        tx.timestamp = new Date().toISOString();

        const token = generateToken(user);
        transaction.update(userRef, {
          credits: user.credits,
          transactions: user.transactions,
          token
        });

        return user;
      });
      return result;
    } catch (err: any) {
      if (err.message.includes("not found") || err.message.includes("already")) throw err;
      console.error("Firestore approvePayment failed, using local db fallback:", err);
    }
  }

  const users = readUsers();
  const user = users[cleanEmail];

  if (!user) {
    throw new Error("User not found.");
  }

  const tx = user.transactions.find(t => t.id === txId);
  if (!tx) {
    throw new Error("Transaction not found.");
  }

  if (tx.status !== "pending") {
    throw new Error(`Transaction is already ${tx.status}.`);
  }

  const creditsBefore = user.credits;
  user.credits += tx.amount;
  tx.status = "approved";
  tx.creditsBefore = creditsBefore;
  tx.creditsAfter = user.credits;
  tx.timestamp = new Date().toISOString();

  users[cleanEmail] = user;
  writeUsers(users);

  return user;
}

// Reject a pending payment
export async function rejectPayment(email: string, txId: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();

  if (db) {
    try {
      const userRef = db.collection("vox_users").doc(cleanEmail);
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        if (!doc.exists) {
          throw new Error("User not found.");
        }
        const user = doc.data() as User;
        const tx = user.transactions?.find(t => t.id === txId);
        if (!tx) {
          throw new Error("Transaction not found.");
        }
        if (tx.status !== "pending") {
          throw new Error(`Transaction is already ${tx.status}.`);
        }

        tx.status = "rejected";
        tx.creditsAfter = user.credits; // unchanged

        const token = generateToken(user);
        transaction.update(userRef, {
          transactions: user.transactions,
          token
        });

        return user;
      });
      return result;
    } catch (err: any) {
      if (err.message.includes("not found") || err.message.includes("already")) throw err;
      console.error("Firestore rejectPayment failed, using local db fallback:", err);
    }
  }

  const users = readUsers();
  const user = users[cleanEmail];

  if (!user) {
    throw new Error("User not found.");
  }

  const tx = user.transactions.find(t => t.id === txId);
  if (!tx) {
    throw new Error("Transaction not found.");
  }

  if (tx.status !== "pending") {
    throw new Error(`Transaction is already ${tx.status}.`);
  }

  tx.status = "rejected";
  tx.creditsAfter = user.credits; // credits remain unchanged

  users[cleanEmail] = user;
  writeUsers(users);

  return user;
}

// Get all payments (for review interface)
export interface PendingTransaction {
  userEmail: string;
  txId: string;
  amount: number;
  referenceId: string;
  timestamp: string;
  status: "pending" | "approved" | "rejected";
  currency?: string;
  amountPaid?: number;
}

export async function getAllPaymentsForReview(): Promise<PendingTransaction[]> {
  if (db) {
    try {
      const snapshot = await db.collection("vox_users").get();
      const list: PendingTransaction[] = [];
      for (const doc of snapshot.docs) {
        const user = doc.data() as User;
        if (user.transactions) {
          for (const tx of user.transactions) {
            if (tx.type === "payment") {
              list.push({
                userEmail: user.email,
                txId: tx.id,
                amount: tx.amount,
                referenceId: decrypt(tx.referenceId || ""),
                timestamp: tx.timestamp,
                status: tx.status || "approved",
                currency: tx.currency,
                amountPaid: tx.amountPaid
              });
            }
          }
        }
      }
      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      console.error("Firestore getAllPaymentsForReview failed, using local db fallback:", err);
    }
  }

  const users = readUsers();
  const list: PendingTransaction[] = [];

  for (const email of Object.keys(users)) {
    const user = users[email];
    for (const tx of user.transactions) {
      if (tx.type === "payment") {
        list.push({
          userEmail: user.email,
          txId: tx.id,
          amount: tx.amount,
          referenceId: decrypt(tx.referenceId || ""),
          timestamp: tx.timestamp,
          status: tx.status || "approved",
          currency: tx.currency,
          amountPaid: tx.amountPaid
        });
      }
    }
  }

  return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
