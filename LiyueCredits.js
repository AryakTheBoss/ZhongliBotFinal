// LiyueCredits.js

const Database = require('better-sqlite3');
const db = new Database('liyue_credits.db');
const SEPERATOR = "_";
let settingsObject = {cooldown: 10800000, amountLimit: 10000, negativeCredits: false};

// Create the table if it doesn't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS credits (
        compositeId TEXT PRIMARY KEY,
        amount INTEGER NOT NULL DEFAULT 1000,
        lastModified INTEGER
    )
`);
db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY,
        cooldown INTEGER,
        amountLimit INTEGER,
        negativeCredits BOOL DEFAULT 0,
    )
`);

class LiyueCredits {
    constructor() {
        this.addStmt = db.prepare('INSERT OR REPLACE INTO credits (compositeId, amount, lastModified) VALUES (?, ?, ?)');
        this.getStmt = db.prepare('SELECT amount, lastModified FROM credits WHERE compositeId = ?');
        this.getAllStmt = db.prepare('SELECT * FROM credits');
        this.getSettingsStmt = db.prepare('SELECT * FROM settings WHERE id = ?');
        this.changeSettingsStmt = db.prepare('INSERT OR REPLACE INTO settings (id, cooldown, amountLimit, negativeCredits) VALUES (?, ?, ?, ?)');
    }

    /**
     * Checks if credits can be removed from a user based on a cooldown.
     * @param {string} userId - The ID of the user.
     * @param {string} guildId - The ID of the guild.
     * @returns {{canRemove: boolean, timeLeft: number|null}} - An object indicating if removal is allowed and the time left if not.
     */
    canRemoveCredits(userId, guildId) {
        const row = this.getStmt.get(userId+SEPERATOR+guildId);
        if (!row || !row.lastModified) {
            return { canRemove: true, timeLeft: null }; // No record or never modified
        }

        const cooldown = settingsObject.cooldown;
        const timeSinceLast = Date.now() - row.lastModified;

        if (timeSinceLast < cooldown) {
            return { canRemove: false, timeLeft: cooldown - timeSinceLast };
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

    getCachedSettings(){
        return settingsObject;
    }

    refreshSettingsFromDB(){
        const settings = this.getSettingsStmt.get(1);
        if(settings){
            settingsObject = {cooldown: settings.cooldown, amountLimit: settings.amountLimit, negativeCredits: settings.negativeCredits};
            console.log("Settings refreshed from the DB");
        }
    }

    changeSettings(cooldown, amountLimit, negativeCredits){
       const newCooldown = cooldown ? cooldown : settingsObject.cooldown;
       const newAmountLimit = amountLimit ? amountLimit : settingsObject.amountLimit;
       const newNegativeCredits = negativeCredits ? negativeCredits : settingsObject.negativeCredits;
       this.changeSettingsStmt.run(1, newCooldown, newAmountLimit, newNegativeCredits);
       console.log("Settings updated");
       this.refreshSettingsFromDB();
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