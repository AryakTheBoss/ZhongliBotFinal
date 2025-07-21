// LiyueCredits.js

const Database = require('better-sqlite3');
const db = new Database('liyue_credits.db');
const SEPERATOR = "_";

// Create the table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS credits (
        compositeId TEXT PRIMARY KEY,
        amount INTEGER NOT NULL DEFAULT 1000,
        lastModified INTEGER
    )
`);

class LiyueCredits {
    constructor() {
        this.addStmt = db.prepare('INSERT OR REPLACE INTO credits (compositeId, amount, lastModified) VALUES (?, ?, ?)');
        this.getStmt = db.prepare('SELECT amount, lastModified FROM credits WHERE compositeId = ?');
        this.getAllStmt = db.prepare('SELECT * FROM credits');
    }

    /**
     * Checks if credits can be removed from a user based on a 24-hour cooldown.
     * @param {string} userId - The ID of the user.
     * @param {string} guildId - The ID of the guild.
     * @returns {{canRemove: boolean, timeLeft: number|null}} - An object indicating if removal is allowed and the time left if not.
     */
    canRemoveCredits(userId, guildId) {
        const row = this.getStmt.get(userId+SEPERATOR+guildId);
        if (!row || !row.lastModified) {
            return { canRemove: true, timeLeft: null }; // No record or never modified
        }

        const twentyFourHours = 1.5 * 60 * 60 * 1000;
        const timeSinceLast = Date.now() - row.lastModified;

        if (timeSinceLast < twentyFourHours) {
            return { canRemove: false, timeLeft: twentyFourHours - timeSinceLast };
        }

        return { canRemove: true, timeLeft: null };
    }

    getLeaderboard(guildId){
        const rows = this.getAllStmt.all();
        const result = new Map();

        if(!rows){
            return new Map();
        }
        for(const row of rows){
            if(this.parseGuildIdFromCompositeId(row.compositeId) === guildId) {
                result.set(this.parseUserIdFromCompositeId(row.compositeId), row.amount);
            }
        }

        return this.sortMapByValueDescending(result);
    }

    parseUserIdFromCompositeId(compositeId){
        return compositeId.split(SEPERATOR)[0];
    }
    parseGuildIdFromCompositeId(compositeId){
        return compositeId.split(SEPERATOR)[1];
    }

     sortMapByValueDescending(mapToSort) {
        // 1. Convert the Map to an array of [key, value] pairs.
        const mapEntries = Array.from(mapToSort.entries());

        // 2. Sort the array based on the value (the second element in each pair).
        // The comparator (b[1] - a[1]) sorts numbers in descending order.
        mapEntries.sort((a, b) => b[1] - a[1]);

        // 3. Create a new Map from the sorted array of pairs.
         return new Map(mapEntries);
    }


    /**
     * Adds Liyue Credits to a user.
     * @param {string} userId - The ID of the user.
     * @param {string} guildId - The ID of the guild.
     * @param {number} amount - The amount of credits to add.
     */
    addCredits(userId, amount, guildId) {
        const currentData = this.getUserData(userId, guildId);
        const newAmount = currentData.amount + amount;
        // When adding credits, we don't update the lastModified timestamp to not interfere with the cooldown
        this.addStmt.run(userId+SEPERATOR+guildId, newAmount, currentData.lastModified);
    }

    /**
     * Removes Liyue Credits from a user and updates their cooldown timestamp.
     * @param {string} userId - The ID of the user.
     * @param {string} guildId - The ID of the guild.
     * @param {number} amount - The amount of credits to remove.
     */
    removeCredits(userId, amount, guildId) {
        const currentCredits = this.checkCredits(userId, guildId);
        const newAmount = currentCredits - amount;
        const now = Date.now();
        this.addStmt.run(userId+SEPERATOR+guildId, newAmount, now);
    }

    /**
     * Checks the Liyue Credits of a user.
     * @param {string} userId - The ID of the user.
     * @param {string} guildId - The ID of the guild.
     * @returns {number} The user's current credit amount.
     */
    checkCredits(userId, guildId) {
        const row = this.getStmt.get(userId+SEPERATOR+guildId);
        return row ? row.amount : 1000; // Return 1000 if user not found
    }

    /**
     * Gets all data for a user.
     * @param {string} userId - The ID of the user.
     * @param {string} guildId - The ID of the guild.
     * @returns {{amount: number, lastModified: number|null}} The user's data.
     */
    getUserData(userId, guildId) {
        const row = this.getStmt.get(userId+SEPERATOR+guildId);
        return row || { amount: 1000, lastModified: null }; // Return 1000 for new users
    }
}

module.exports = LiyueCredits;