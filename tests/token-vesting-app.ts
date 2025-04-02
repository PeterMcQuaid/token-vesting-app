import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { TokenVestingApp } from "../target/types/token_vesting_app";
import { Keypair, PublicKey } from "@solana/web3.js";
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { SystemProgram } from "@solana/web3.js";
import fs from "fs";
import { homedir } from "os";

const IDL = require("../target/idl/token_vesting_app.json");
const walletPath = `${homedir()}/.config/solana/id.json`;
// Bringing in the default signer
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf8")));
const dummyMint = Keypair.generate().publicKey;
const keypair = Keypair.fromSecretKey(secretKey);
const localProvider = anchor.AnchorProvider.env();

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

  // ----------------------------------
  // MODULE: Global State Initialization Tests
  // ----------------------------------

  it("Successfully passes onlyOwner access control and correct event emitted", async () => {
    // Setting the local provider to avoid bankrun for this test, so I can invoke 'getTransaction' method
    anchor.setProvider(localProvider);
    vestingProgram = new Program<TokenVestingApp>(
      IDL,
      localProvider,
    );

    const connection = vestingProgram.provider.connection;

    const tx = await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    expect(tx.length).toBeGreaterThan(0);  

    // Need this step to make sure logs are not null
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      {
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: tx,
      },
      "confirmed"
    );

    const txDetails = await connection.getTransaction(tx, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0, // Important for compatibility with v0 transactions
    });

    const logs = txDetails?.meta?.logMessages || null;

    if (!logs) {
      console.log("No logs found");
    }
  
    console.log("Logs: ", logs);
    expect(logs).toContain("Program log: Instruction: Initialize");   // Test doesn't actually confirm event log data, just whether correct event was emitted, may amend in the future
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

    await expect(vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: wrongSigner.publicKey,
      })
      .signers([wrongSigner])
      .rpc()
    ).rejects.toThrow(IDL.errors[0].msg);
  });

  it("Initializes the global state", async () => {
    await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

      const [globalStateAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("global_state")],
        vestingProgram.programId,
      )
  
      const globalState = await vestingProgram.account.globalState.fetch(globalStateAddress);

      expect(globalState.mint).toEqual(dummyMint);
      expect(globalState.initialized).toEqual(true);
      expect(globalState.authority).toEqual(keypair.publicKey);
  });

  it("Reverts when global state already initialized", async () => {
    const tx = new anchor.web3.Transaction();
    const init = await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .instruction();

    tx.add(init);           // First initialize call
    tx.add(init);           // Second initialize call (will fail in-program)

    await expect(provider.sendAndConfirm(tx, [keypair])).rejects.toThrow(IDL.errors[1].msg);
  });

  // ----------------------------------
  // MODULE: Deposit Sol Tests
  // ----------------------------------

  it("Stakes SOL for unprivledged user", async () => {

    

  });
});