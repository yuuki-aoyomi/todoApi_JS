const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
    host: "db",
    port: 5432,
    user: "user",
    password: "pass",
    database: "todo"
});

//接続できるまでリトライ
async function waitForDB() {
    for (let i = 0; i < 10; i++) {
        try {
            await pool.query("SELECT 1");
            console.log("DB connected");
            return;
        } catch (err) {
            console.log("waiting for DB...");
            await new Promise(res => setTimeout(res, 2000));
        }
    }
    throw new Error("DB connection failed");
}

async function main() {
    //DB起動待ち
    await waitForDB();

    //初期化
    await pool.query(`
        CREATE TABLE IF NOT EXISTS todos (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            done BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    //一覧取得
    app.get("/todos", async (req, res) => {
        const result = await pool.query(
            "SELECT * FROM todos ORDER BY created_at DESC"
        );
        res.json(result.rows);
    });

    //todo追加
    app.post("/todos", async (req, res) => {
        const { title } = req.body;
        if (!title || title.trim() === "") {
            return res.status(400).json({ error: "title is required" });
        }

        const result = await pool.query(
            "INSERT INTO todos (title) VALUES ($1) RETURNING id",
            [title]
        );

        res.json({ id: result.rows[0].id });
    });

    //達成状況変更
    app.patch("/todos/:id", async (req, res) => {
        const { done } = req.body;

        await pool.query(
            "UPDATE todos SET done = $1 WHERE id = $2",
            [done, req.params.id]
        );
    });

    //削除
    app.delete("/todos/:id", async (req, res) => {
        await pool.query("DELETE FROM todos WHERE id = $1",
            [req.params.id]
        );
        res.json({ success: true });
    });

    app.listen(3000, () => {
        console.log("Todo API (PostgreSQL) runnning on http://localhost:3000");
    });
}
main();