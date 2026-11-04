import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { AppDb } from "../db";
import { categoriesForNote } from "../category-history";

it("ranks competing categories using only exact notes from the selected account, direction and workspace", async () => {
  const client = new PGlite();
  try {
    const db = drizzle(client);
    await migrate(db,{migrationsFolder:"./drizzle"});
    await client.exec(`INSERT INTO users(id,email,password_hash) VALUES ('u','test@example.invalid','x');
      INSERT INTO workspaces(id,name,owner_id) VALUES ('w','Home','u'),('other','Other','u');
      INSERT INTO accounts(id,workspace_id,name) VALUES ('a','w','Bank'),('b','w','Card'),('c','other','Bank');
      INSERT INTO categories(id,workspace_id,name,kind) VALUES ('g','w','Groceries','expense'),('f','w','Food','expense'),
        ('i','w','Income','income'),('o','other','Other','expense');
      INSERT INTO transactions(id,workspace_id,account_id,category_id,note,type,date,amount) VALUES
        ('1','w','a','g',' COFFEE ','expense',CURRENT_DATE,3),('2','w','a','g','Coffee','expense',CURRENT_DATE,5),
        ('3','w','a','f','coffee','expense',CURRENT_DATE,7),('4','w','b','f','coffee','expense',CURRENT_DATE,7),
        ('5','w','a','f','coffee beans','expense',CURRENT_DATE,7),('6','w','a','i','coffee','income',CURRENT_DATE,7),
        ('7','other','c','o','coffee','expense',CURRENT_DATE,7),('8','w','a',null,'coffee','expense',CURRENT_DATE,7);`);
    const lookup=(account:string,note:string)=>categoriesForNote(db as unknown as AppDb,"w",account,"expense",note);
    expect(await lookup("a"," Coffee ")).toEqual([{categoryId:"g",count:2},{categoryId:"f",count:1}]);
    expect(await lookup("c","coffee")).toEqual([]);
    expect(await lookup("a","co%")).toEqual([]);
  } finally { await client.close(); }
},60000);
