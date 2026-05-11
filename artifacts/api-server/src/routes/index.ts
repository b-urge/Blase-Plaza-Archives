import { Router, type IRouter } from "express";
import healthRouter from "./health";
import surveysRouter from "./surveys";
import permitsRouter from "./permits";
import apiV1Router from "./apiV1";
import apiKeysRouter from "./apiKeys";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(surveysRouter);
router.use(permitsRouter);
router.use(apiKeysRouter);
router.use(apiV1Router);
router.use(adminRouter);

export default router;
