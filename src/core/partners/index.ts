import { GrabExpressPartner } from "./grabexpress/GrabExpressPartner.js";
import { DeliverooPartner } from "./deliveroo_sg/DeliverooPartner.js";
import { FoodpandaPartner } from "./foodpanda_sg/FoodpandaPartner.js";
import { UparcelPartner } from "./uparcel/UparcelPartner.js";
import { EasyparcelPartner } from "./easyparcel_sg/EasyparcelPartner.js";
import { LalamovePartner } from "./lalamove/LalamovePartner.js";
import type { DeliveryPartner } from "./DeliveryPartner.js";

export const partners: DeliveryPartner[] = [
  new GrabExpressPartner(),
  new DeliverooPartner(),
  new FoodpandaPartner(),
  new UparcelPartner(),
  new EasyparcelPartner(),
  new LalamovePartner(),
];
