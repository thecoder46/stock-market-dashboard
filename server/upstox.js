import dotenv from "dotenv";
import { fileURLToPath } from "url";
import UpstoxClient from "upstox-js-sdk";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
dotenv.config({ path: envPath });

const accessToken = process.env.UPSTOX_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error(`UPSTOX_ACCESS_TOKEN is missing. Env path: ${envPath}`);
}

console.log("Upstox access token loaded");

const client = UpstoxClient.ApiClient.instance;
client.authentications["OAUTH2"].accessToken = accessToken;

const streamer = new UpstoxClient.MarketDataStreamerV3();

let connected = false;
const subscriptions = new Set();

export function connectUpstox() {
  return new Promise((resolve, reject) => {
    streamer.on("open", () => {
      connected = true;
      console.log("Connected to Upstox market data");
      resolve();
    });

    streamer.on("message", (data) => {
    if (global.handleMarketData) {
        global.handleMarketData(data);
    }
    });

    streamer.on("error", (error) => {
      console.error("Upstox WebSocket error:", error);
      connected = false;
    });

    streamer.on("close", () => {
      connected = false;
      console.log("Upstox market data connection closed");
    });

    streamer.connect();
  });
}

export function subscribeInstruments(instrumentKeys) {
  if (!connected) {
    console.log("Upstox is not connected");
    return;
  }

  const newKeys = instrumentKeys.filter(
    (key) => !subscriptions.has(key)
  );

  if (!newKeys.length) {
    return;
  }

  streamer.subscribe(newKeys, "full");

  newKeys.forEach((key) => {
    subscriptions.add(key);
  });

  console.log("Subscribed:", newKeys);
}

export function unsubscribeInstruments(instrumentKeys) {
  if (!connected) {
    console.log("Upstox is not connected");
    return;
  }

  const existingKeys = instrumentKeys.filter(
    (key) => subscriptions.has(key)
  );

  if (!existingKeys.length) {
    return;
  }

  streamer.unsubscribe(existingKeys);

  existingKeys.forEach((key) => {
    subscriptions.delete(key);
  });

  console.log("Unsubscribed:", existingKeys);
}

export function getSubscriptions() {
  return [...subscriptions];
}

export function isUpstoxConnected() {
  return connected;
}