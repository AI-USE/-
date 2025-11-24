'use strict';

const W3S_IPFS_GATEWAY = 'https://w3s.link';

// This is a placeholder for the user's API token.
// In a real application, the user would need to provide this.
let web3StorageToken = null;
let web3StorageClient = null;

/**
 * Initializes the web3.storage client. Must be called before uploading.
 * @param {string} token The web3.storage API token.
 */
function initializeIpfsClient(token) {
    if (!token) {
        throw new Error('web3.storage API token is required.');
    }
    web3StorageToken = token;
    web3StorageClient = new Web3Storage.Web3Storage({ token: web3StorageToken });
    console.log('web3.storage client initialized.');
}

/**
 * Uploads data to IPFS using web3.storage.
 * @param {string | Blob} data The data to upload.
 * @returns {Promise<string>} The CID of the uploaded data.
 */
async function uploadToIPFS(data) {
    if (!web3StorageClient) {
        throw new Error('IPFS client is not initialized. Please call initializeIpfsClient first.');
    }

    const blob = data instanceof Blob ? data : new Blob([data]);
    const file = new File([blob], 'data.json', { type: 'application/json' });

    try {
        console.log('Uploading to web3.storage...');
        const cid = await web3StorageClient.put([file], { wrapWithDirectory: false });
        console.log('Upload successful. CID:', cid);
        return cid;
    } catch (error) {
        console.error('Error uploading to web3.storage:', error);
        throw error;
    }
}

/**
 * Downloads data from IPFS using a public gateway.
 * @param {string} cid The CID of the data to download.
 * @returns {Promise<string>} The content of the file as a string.
 */
async function downloadFromIPFS(cid) {
    try {
        const url = `${W3S_IPFS_GATEWAY}/ipfs/${cid}`;
        console.log(`Downloading from: ${url}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`IPFS download failed: ${response.statusText}`);
        }

        const content = await response.text();
        console.log(`Downloaded from IPFS (CID: ${cid})`);
        return content;
    } catch (error) {
        console.error(`Error downloading from IPFS (CID: ${cid}):`, error);
        throw error;
    }
}

// Example usage to guide the user:
/*
const token = prompt('Please enter your web3.storage API token:');
if (token) {
    initializeIpfsClient(token);
    // Now you can call uploadToIPFS and downloadFromIPFS
}
*/
