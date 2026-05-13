// Rithmic R-API|+ Protocol Buffers schemas — minimal subset for browser
// market-data client. Field numbers match Rithmic's published .proto files.
// Each message carries its own template_id; that's the dispatch key.

import protobuf from "protobufjs/light";

const root = protobuf.Root.fromJSON({
  nested: {
    rithmic: {
      nested: {
        // Generic peek: every message has template_id=154467. We decode this
        // first to find out what concrete type to decode the rest as.
        Envelope: {
          fields: { template_id: { type: "int32", id: 154467 } },
        },

        RequestLogin: {
          fields: {
            template_id: { type: "int32", id: 154467 },           // = 10
            user_msg: { rule: "repeated", type: "string", id: 132760 },
            template_version: { type: "string", id: 132000 },
            user: { type: "string", id: 132010 },
            password: { type: "string", id: 132011 },
            app_name: { type: "string", id: 132012 },
            app_version: { type: "string", id: 132013 },
            system_name: { type: "string", id: 132014 },
            infra_type: { type: "int32", id: 154095 }, // 1=TICKER 2=ORDER 3=PNL 4=HISTORY
            mac_addr: { rule: "repeated", type: "string", id: 132015 },
            os_version: { type: "string", id: 132016 },
            os_platform: { type: "string", id: 132017 },
            aggregated_quotes: { type: "bool", id: 132018 },
          },
        },

        ResponseLogin: {
          fields: {
            template_id: { type: "int32", id: 154467 },           // = 11
            template_version: { type: "string", id: 132000 },
            user_msg: { rule: "repeated", type: "string", id: 132760 },
            rp_code: { rule: "repeated", type: "string", id: 132016 },
            fcm_id: { type: "string", id: 154013 },
            ib_id: { type: "string", id: 154014 },
            country_code: { type: "string", id: 154015 },
            state_code: { type: "string", id: 154016 },
            heartbeat_interval: { type: "int32", id: 154017 },
            unique_user_id: { type: "string", id: 154018 },
          },
        },

        RequestHeartbeat: {
          fields: {
            template_id: { type: "int32", id: 154467 },           // = 18
            user_msg: { rule: "repeated", type: "string", id: 132760 },
          },
        },

        ResponseHeartbeat: {
          fields: {
            template_id: { type: "int32", id: 154467 },           // = 19
            user_msg: { rule: "repeated", type: "string", id: 132760 },
            ssboe: { type: "int32", id: 154467001 },
            usecs: { type: "int32", id: 154467002 },
          },
        },

        RequestMarketDataUpdate: {
          fields: {
            template_id: { type: "int32", id: 154467 },           // = 100
            user_msg: { rule: "repeated", type: "string", id: 132760 },
            symbol: { type: "string", id: 132016 },
            exchange: { type: "string", id: 132017 },
            request: { type: "int32", id: 132018 },               // 1=SUBSCRIBE 2=UNSUBSCRIBE
            update_bits: { type: "uint32", id: 132019 },          // bitmask
          },
        },

        ResponseMarketDataUpdate: {
          fields: {
            template_id: { type: "int32", id: 154467 },           // = 101
            user_msg: { rule: "repeated", type: "string", id: 132760 },
            rp_code: { rule: "repeated", type: "string", id: 132015 },
          },
        },

        LastTrade: {
          fields: {
            template_id: { type: "int32", id: 154467 },           // = 150
            symbol: { type: "string", id: 132010 },
            exchange: { type: "string", id: 132011 },
            trade_price: { type: "double", id: 154004 },
            trade_size: { type: "int32", id: 154005 },
            aggressor: { type: "int32", id: 154006 },             // 1=BUY 2=SELL
            ssboe: { type: "int32", id: 154010 },
            usecs: { type: "int32", id: 154011 },
          },
        },

        BestBidOffer: {
          fields: {
            template_id: { type: "int32", id: 154467 },           // = 151
            symbol: { type: "string", id: 132010 },
            exchange: { type: "string", id: 132011 },
            bid_price: { type: "double", id: 154100 },
            bid_size: { type: "int32", id: 154101 },
            ask_price: { type: "double", id: 154102 },
            ask_size: { type: "int32", id: 154103 },
          },
        },
      },
    },
  },
});

export const Envelope = root.lookupType("rithmic.Envelope");
export const RequestLogin = root.lookupType("rithmic.RequestLogin");
export const ResponseLogin = root.lookupType("rithmic.ResponseLogin");
export const RequestHeartbeat = root.lookupType("rithmic.RequestHeartbeat");
export const ResponseHeartbeat = root.lookupType("rithmic.ResponseHeartbeat");
export const RequestMarketDataUpdate = root.lookupType("rithmic.RequestMarketDataUpdate");
export const ResponseMarketDataUpdate = root.lookupType("rithmic.ResponseMarketDataUpdate");
export const LastTrade = root.lookupType("rithmic.LastTrade");
export const BestBidOffer = root.lookupType("rithmic.BestBidOffer");

export const TEMPLATE = {
  RequestLogin: 10,
  ResponseLogin: 11,
  RequestHeartbeat: 18,
  ResponseHeartbeat: 19,
  RequestMarketDataUpdate: 100,
  ResponseMarketDataUpdate: 101,
  LastTrade: 150,
  BestBidOffer: 151,
} as const;

export const INFRA_TYPE = {
  TICKER_PLANT: 1,
  ORDER_PLANT: 2,
  PNL_PLANT: 3,
  HISTORY_PLANT: 4,
} as const;

export const MDU_BITS = {
  LAST_TRADE: 0x1,
  BBO: 0x2,
  ORDER_BOOK: 0x4,
  OPEN: 0x8,
  CLOSE: 0x10,
} as const;

export const MDU_REQ = { SUBSCRIBE: 1, UNSUBSCRIBE: 2 } as const;
