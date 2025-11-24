'use strict';

class CryptoManager {
    constructor() {
        this.key = null; // AES-GCM key derived from the password
    }

    /**
     * Generates a random salt.
     * @returns {Uint8Array} A 16-byte random salt.
     */
    generateSalt() {
        return window.crypto.getRandomValues(new Uint8Array(16));
    }

    /**
     * Derives an AES-GCM key from a password and salt using PBKDF2.
     * @param {string} password The user's password.
     * @param {Uint8Array} salt The salt to use for key derivation.
     * @returns {Promise<CryptoKey>}
     */
    async deriveKeyFromPassword(password, salt) {
        const encoder = new TextEncoder();
        const baseKey = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        this.key = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000, // A common number of iterations
                hash: 'SHA-256',
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        console.log('AES-GCM key derived from password.');
        return this.key;
    }
    
    /**
     * Encrypts a message with the current key.
     * @param {string} plaintext The message to encrypt.
     * @returns {Promise<string>} Base64 encoded ciphertext with IV.
     */
    async encrypt(plaintext) {
        if (!this.key) throw new Error('Key is not derived. Cannot encrypt.');

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedText = new TextEncoder().encode(plaintext);

        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            this.key,
            encodedText
        );

        const ivAndCiphertext = new Uint8Array(iv.length + ciphertext.byteLength);
        ivAndCiphertext.set(iv);
        ivAndCiphertext.set(new Uint8Array(ciphertext), iv.length);

        return this.arrayBufferToBase64(ivAndCiphertext.buffer);
    }

    /**
     * Decrypts a message with the current key.
     * @param {string} base64Ciphertext Base64 encoded ciphertext with IV.
     * @returns {Promise<string>} The original plaintext.
     */
    async decrypt(base64Ciphertext) {
        if (!this.key) throw new Error('Key is not derived. Cannot decrypt.');

        const ivAndCiphertext = this.base64ToArrayBuffer(base64Ciphertext);
        const iv = ivAndCiphertext.slice(0, 12);
        const ciphertext = ivAndCiphertext.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            this.key,
            ciphertext
        );

        return new TextDecoder().decode(decrypted);
    }

    // Helper functions for Base64 conversion
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    base64ToArrayBuffer(base64) {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;
    }
}
