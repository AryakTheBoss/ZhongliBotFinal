// LiyueCredits.js

const Database = require('better-sqlite3');
const db = new Database('liyue_credits.db');

// Create the table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS credits (
        userId TEXT PRIMARY KEY,
        amount INTEGER NOT NULL
    )
`);

class LiyueCredits {
    constructor() {
        this.addStmt = db.prepare('INSERT OR REPLACE INTO credits (userId, amount) VALUES (?, ?)');
        this.getStmt = db.prepare('SELECT amount FROM credits WHERE userId = ?');
        this.removeStmt = db.prepare('UPDATE credits SET amount = ? WHERE userId = ?');
    }

    /**
     * Adds Liyue Credits to a user.
     * @param {string} userId - The ID of the user.
     * @param {number} amount - The amount of credits to add.
     */
    addCredits(userId, amount) {
        const currentCredits = this.checkCredits(userId);
        const newAmount = currentCredits + amount;
        this.addStmt.run(userId, newAmount);
    }

    /**
     * Removes Liyue Credits from a user.
     * @param {string} userId - The ID of the user.
     * @param {number} amount - The amount of credits to remove.
     */
    removeCredits(userId, amount) {
        const currentCredits = this.checkCredits(userId);
        const newAmount = currentCredits - amount; // Ensure credits don't go below 0
        this.removeStmt.run(newAmount, userId);
    }

    /**
     * Checks the Liyue Credits of a user.
     * @param {string} userId - The ID of the user.
     * @returns {number} The user's current credit amount.
     */
    checkCredits(userId) {
        const row = this.getStmt.get(userId);
        return row ? row.amount : 0;
    }
}

module.exports = LiyueCredits;