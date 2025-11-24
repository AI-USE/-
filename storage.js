'use strict';

const SESSION_STORAGE_KEY = 'secureP2pChatSession';
const W3S_TOKEN_KEY = 'web3StorageApiToken';
const WORKER_URL_KEY = 'pushWorkerUrl';

class StorageManager {
    /**
     * Saves the session data to localStorage.
     * @param {object} sessionData The data to save.
     */
    static saveSession(sessionData) {
        try {
            const data = JSON.stringify(sessionData);
            localStorage.setItem(SESSION_STORAGE_KEY, data);
            console.log('Session data saved.');
        } catch (error) {
            console.error('Failed to save session data:', error);
        }
    }

    /**
     * Loads the session data from localStorage.
     * @returns {object|null} The saved session data, or null if not found.
     */
    static loadSession() {
        try {
            const data = localStorage.getItem(SESSION_STORAGE_KEY);
            if (data) {
                console.log('Session data loaded.');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to load session data:', error);
        }
        return null;
    }

    /**
     * Clears the session data from localStorage.
     */
    static clearSession() {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        console.log('Session data cleared.');
    }

    /**
     * Saves the web3.storage API token.
     * @param {string} token 
     */
    static saveApiToken(token) {
        localStorage.setItem(W3S_TOKEN_KEY, token);
    }

    /**
     * Loads the web3.storage API token.
     * @returns {string|null}
     */
    static loadApiToken() {
        return localStorage.getItem(W3S_TOKEN_KEY);
    }

    /**
     * Saves the push worker URL.
     * @param {string} url 
     */
    static saveWorkerUrl(url) {
        localStorage.setItem(WORKER_URL_KEY, url);
    }

    /**
     * Loads the push worker URL.
     * @returns {string|null}
     */
    static loadWorkerUrl() {
        return localStorage.getItem(WORKER_URL_KEY);
    }
}
