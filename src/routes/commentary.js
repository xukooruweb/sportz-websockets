import { Router } from "express";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import { matchIdParamSchema } from "../validation/matches.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { desc, eq } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });

const COMMENTARY_MAX_LIMIT = 100;

commentaryRouter.get("/", async (req, res) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({
      error: "Invalid match id parameter",
      details: JSON.parse(JSON.stringify(paramsResult.error.format())),
    });
  }

  const queryResult = listCommentaryQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({
      error: "Invalid query parameters",
      details: JSON.parse(JSON.stringify(queryResult.error.format())),
    });
  }

  const limit = Math.min(
    queryResult.data.limit ?? COMMENTARY_MAX_LIMIT,
    COMMENTARY_MAX_LIMIT,
  );

  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, paramsResult.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    res.json({ data });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch commentary",
      details: JSON.parse(JSON.stringify(error)),
    });
  }
});

commentaryRouter.post("/", async (req, res) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);

  if (!paramsResult.success) {
    return res.status(400).json({
      error: "Invalid match id parameter",
      details: JSON.parse(JSON.stringify(paramsResult.error.format())),
    });
  }

  const bodyResult = createCommentarySchema.safeParse(req.body);

  if (!bodyResult.success) {
    return res.status(400).json({
      error: "Invalid commentary payload",
      details: JSON.parse(JSON.stringify(bodyResult.error.format())),
    });
  }

  try {
    const [createdCommentary] = await db
      .insert(commentary)
      .values({
        matchId: paramsResult.data.id,
        ...bodyResult.data,
      })
      .returning();

    res.status(201).json({ data: createdCommentary });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to create commentary",
      details: JSON.parse(JSON.stringify(error)),
    });
  }
});
