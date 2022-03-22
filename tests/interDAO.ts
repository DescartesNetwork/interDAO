import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { InterDao } from "../target/types/inter_dao";

describe("interDAO", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.InterDao as Program<InterDao>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
