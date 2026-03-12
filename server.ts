import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";

const db = new Database("workouts.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    prepTime INTEGER NOT NULL,
    workTime INTEGER NOT NULL,
    restTime INTEGER NOT NULL,
    rounds INTEGER NOT NULL,
    isDefault INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Add isDefault column if it doesn't exist
try {
  db.exec("ALTER TABLE timers ADD COLUMN isDefault INTEGER DEFAULT 0");
} catch (e) {
  // Column already exists or table doesn't exist yet
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/timers", (req, res) => {
    try {
      const timers = db.prepare("SELECT * FROM timers ORDER BY createdAt DESC").all();
      res.json(timers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch timers" });
    }
  });

  app.post("/api/timers", (req, res) => {
    const { name, prepTime, workTime, restTime, rounds } = req.body;
    if (!name || !prepTime || !workTime || !restTime || !rounds) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const info = db.prepare(`
        INSERT INTO timers (name, prepTime, workTime, restTime, rounds)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, prepTime, workTime, restTime, rounds);
      
      const newTimer = db.prepare("SELECT * FROM timers WHERE id = ?").get(info.lastInsertRowid);
      res.json(newTimer);
    } catch (error) {
      res.status(500).json({ error: "Failed to save timer" });
    }
  });

  app.patch("/api/timers/:id", (req, res) => {
    const { name, isDefault } = req.body;
    
    try {
      if (name !== undefined) {
        db.prepare("UPDATE timers SET name = ? WHERE id = ?").run(name, req.params.id);
      }
      
      if (isDefault === 1) {
        // Unset all other defaults
        db.prepare("UPDATE timers SET isDefault = 0").run();
        // Set this one as default
        db.prepare("UPDATE timers SET isDefault = 1 WHERE id = ?").run(req.params.id);
      } else if (isDefault === 0) {
        db.prepare("UPDATE timers SET isDefault = 0 WHERE id = ?").run(req.params.id);
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update timer" });
    }
  });

  app.delete("/api/timers/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM timers WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete timer" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
