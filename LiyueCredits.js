// LiyueCredits.js

const Database = require('better-sqlite3');
const db = new Database('liyue_credits.db');

// Create the table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS credits (
        userId TEXT PRIMARY KEY,
        amount INTEGER NOT NULL DEFAULT 1000,
        lastModified INTEGER
    )
`);

class LiyueCredits {
    constructor() {
        this.addStmt = db.prepare('INSERT OR REPLACE INTO credits (userId, amount, lastModified) VALUES (?, ?, ?)');
        this.getStmt = db.prepare('SELECT amount, lastModified FROM credits WHERE userId = ?');
    }

    /**
     * Checks if credits can be removed from a user based on a 24-hour cooldown.
     * @param {string} userId - The ID of the user.
     * @returns {{canRemove: boolean, timeLeft: number|null}} - An object indicating if removal is allowed and the time left if not.
     */
    canRemoveCredits(userId) {
        const row = this.getStmt.get(userId);
        if (!row || !row.lastModified) {
            return { canRemove: true, timeLeft: null }; // No record or never modified
        }

        const twentyFourHours = 8 * 60 * 60 * 1000;
        const timeSinceLast = Date.now() - row.lastModified;

        if (timeSinceLast < twentyFourHours) {
            return { canRemove: false, timeLeft: twentyFourHours - timeSinceLast };
        }

        return { canRemove: true, timeLeft: null };
    }


    /**
     * Adds Liyue Credits to a user.
     * @param {string} userId - The ID of the user.
     * @param {number} amount - The amount of credits to add.
     */
    addCredits(userId, amount) {
        const currentData = this.getUserData(userId);
        const newAmount = currentData.amount + amount;
        // When adding credits, we don't update the lastModified timestamp to not interfere with the cooldown
        this.addStmt.run(userId, newAmount, currentData.lastModified);
    }

    /**
     * Removes Liyue Credits from a user and updates their cooldown timestamp.
     * @param {string} userId - The ID of the user.
     * @param {number} amount - The amount of credits to remove.
     */
    removeCredits(userId, amount) {
        const currentCredits = this.checkCredits(userId);
        const newAmount = currentCredits - amount;
        const now = Date.now();
        this.addStmt.run(userId, newAmount, now);
    }

    /**
     * Checks the Liyue Credits of a user.
     * @param {string} userId - The ID of the user.
     * @returns {number} The user's current credit amount.
     */
    checkCredits(userId) {
        const row = this.getStmt.get(userId);
        return row ? row.amount : 1000; // Return 1000 if user not found
    }

    /**
     * Gets all data for a user.
     * @param {string} userId - The ID of the user.
     * @returns {{amount: number, lastModified: number|null}} The user's data.
     */
    getUserData(userId) {
        const row = this.getStmt.get(userId);
        return row || { amount: 1000, lastModified: null }; // Return 1000 for new users
    }
}

module.exports = LiyueCredits;