import { Client } from "@notionhq/client";
import { readFileSync } from "fs";

const settings = JSON.parse(readFileSync("./settings.json", "utf-8"));
const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

if (!databaseId) {
  console.error("Please specify NOTION_DATABASE_ID");
  console.log(databaseId);
  process.exit(1);
}

export async function* pickPageIdsWithTags(tags: string[]) {
  let currentCursor: string | undefined = undefined;
  while (1) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: currentCursor,
      filter: {
        or: tags.map((item) => ({
          property: settings.tagColumn,
          multi_select: {
            contains: item,
          },
        })),
      },
    });

    for (const item of response.results) {
      yield item.id;
    }

    if (response.next_cursor) {
      currentCursor = response.next_cursor;
      continue;
    }
    break;
  }
}

async function refreshDailyTodo() {
  for await (const pageId of pickPageIdsWithTags([settings.dailyTag])) {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        [settings.statusColumn]: {
          select: {
            name: settings.todoStatusValue,
          },
        },
      },
    });
  }
}

async function daily() {
  refreshDailyTodo()
}

async function main() {
  const task = process.argv[2];

  switch (task) {
    case "daily":
      await daily();
      break;
    case undefined:
      throw new Error("Please specify task");
    default:
      throw new Error(`No such task ${task}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
