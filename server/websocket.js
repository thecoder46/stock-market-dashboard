import { WebSocketServer } from "ws";
import {
  getAllMarketData,
  addMarketDataListener,
  removeMarketDataListener,
} from "./marketData.js";

export function setupWebSocket(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws/market",
  });

  const broadcast = (data) => {
    const message = JSON.stringify({
      type: "market_update",
      data,
    });

    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  };

  addMarketDataListener(broadcast);

  wss.on("connection", (socket) => {
    console.log("Browser connected to market WebSocket");

    socket.send(
      JSON.stringify({
        type: "market_snapshot",
        data: getAllMarketData(),
      })
    );

    socket.on("close", () => {
      console.log("Browser disconnected");
    });
  });

  return wss;
}