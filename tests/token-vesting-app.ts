import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { TokenVestingApp } from "../target/types/token_vesting_app";
import { Keypair } from "@solana/web3.js";
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { SystemProgram } from "@solana/web3.js";
import fs from "fs";
import { homedir } from "os";

const IDL = require("../target/idl/token_vesting_app.json");
const walletPath = `${homedir()}/.config/solana/id.json`;
// Bringing in the default signer
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")));
const keypair = Keypair.fromSecretKey(secretKey);

describe("token-vesting-app", () => {

  let context;
  let provider;
  let vestingProgram: Program<TokenVestingApp>;

  beforeEach(async () => {
    context = await startAnchor(".", [{name: "token_vesting_app", programId: Keypair.generate().publicKey}], [{
      address: keypair.publicKey, // Funding default wallet (not default under bankrun)
      info: {
      lamports: 1_000_000_000, // 1 SOL equivalent
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
      },
  }]);
    provider = new BankrunProvider(context);
    vestingProgram = new Program<TokenVestingApp>(
      IDL,
      provider,
    );
  })
  
  //const ERRORS = Object.fromEntries(IDL.errors.map((e: any) => [e.name, e]));
  const dummyMint = Keypair.generate().publicKey;

  it("Successfully passes onlyOwner access control", async () => {
    // Add your test here.
    const tx = await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();
  });


  it("Fails onlyOwner access control with wrong signer", async () => {
    let wrongSigner = anchor.web3.Keypair.generate();

    // Funding wrong signer
    await context.setAccount(wrongSigner.publicKey, {
      lamports: 1_000_000_000, // 1 SOL explicitly for testing
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    // Add your test here.
    const tx = await expect(vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: wrongSigner.publicKey,
      })
      .signers([wrongSigner])
      .rpc()
    ).rejects.toThrow(IDL.errors[0].msg);
  });
});