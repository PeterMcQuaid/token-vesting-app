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
    ).rejects.toThrow(IDL.errors[0].msg);   // NotOwner
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

    await expect(provider.sendAndConfirm(tx, [keypair])).rejects.toThrow(IDL.errors[1].msg);  // AlreadyInitialized
  });

  // ----------------------------------
  // MODULE: Stake/unstake Sol Tests
  // ----------------------------------

  it("Stakes SOL for unprivledged user", async () => {
    const stakeAmount = new BN(1e9);
    let staker = anchor.web3.Keypair.generate();

    // Have to initialize global state first
    await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    // Funding staker
    await context.setAccount(staker.publicKey, {
      lamports: 2_000_000_000, // 2 SOL
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    try {     // @dev Example of getting more debug info from failed transactions
      const tx = await vestingProgram.methods
        .stake(stakeAmount)
        .accounts({
          staker: staker.publicKey,
        })
        .signers([staker])
        .rpc();

      expect(tx.length).toBeGreaterThan(0);  
    } catch (err) {
      console.error("❌ Stake transaction failed:", err);
      throw err; // re-throw to still fail the test
    }

    // Confirming the stake
    const [userStakePDA] = PublicKey.findProgramAddressSync( 
      [staker.publicKey.toBuffer()],
      vestingProgram.programId,
    )
    const userPDAState = await vestingProgram.account.userStake.fetch(userStakePDA);
    expect(userPDAState.staker).toEqual(staker.publicKey);
    expect(userPDAState.amount.toNumber()).toEqual(stakeAmount.toNumber());
  });


  it("Stake 0 amount fails", async () => {
    const stakeAmount = new BN(0);
    let staker = anchor.web3.Keypair.generate();

    // Have to initialize global state first
    await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    // Funding staker
    await context.setAccount(staker.publicKey, {
      lamports: 2_000_000_000, // 2 SOL     // Still need balance
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    const tx = await expect(vestingProgram.methods
      .stake(stakeAmount)
      .accounts({
        staker: staker.publicKey,
      })
      .signers([staker])
      .rpc()).rejects.toThrow(IDL.errors[4].msg);   // InvalidAmount    
  });


  it("Stake exceeding max allowance amount fails", async () => {
    const stakeAmount = new BN(1e9 + 1);
    let staker = anchor.web3.Keypair.generate();

    // Have to initialize global state first
    await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    // Funding staker
    await context.setAccount(staker.publicKey, {
      lamports: 2_000_000_000, // 2 SOL     // Still need balance
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    const tx = await expect(vestingProgram.methods
      .stake(stakeAmount)
      .accounts({
        staker: staker.publicKey,
      })
      .signers([staker])
      .rpc()).rejects.toThrow(IDL.errors[5].msg);   // MaxStakeExceeded    
  });


  it("Stake exceeding max allowance amount fails across multiple deposits", async () => {
    let stakeAmount = new BN(1e9);
    let staker = anchor.web3.Keypair.generate();

    // Have to initialize global state first
    await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    // Funding staker
    await context.setAccount(staker.publicKey, {
      lamports: 2_000_000_000, // 2 SOL     // Still need balance
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    // 2 stakes of 1 SOL and 1 lamport
    const tx = new anchor.web3.Transaction();
    let stake = await vestingProgram.methods
      .stake(stakeAmount)
      .accounts({
        staker: staker.publicKey,
      })
      .signers([staker])
      .instruction();
    tx.add(stake); 
    stakeAmount = new BN(1);
    stake = await vestingProgram.methods
      .stake(stakeAmount)
      .accounts({
        staker: staker.publicKey,
      })
      .signers([staker])
      .instruction();
    tx.add(stake);

    await expect(provider.sendAndConfirm(tx, [staker])).rejects.toThrow(IDL.errors[5].msg);  // MaxStakeExceeded  
  });


  it("Confirm 2 stakes updates balance correctly", async () => {
    let stakeAmount = new BN(2e8);
    let staker = anchor.web3.Keypair.generate();

    // Have to initialize global state first
    await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    // Funding staker
    await context.setAccount(staker.publicKey, {
      lamports: 2_000_000_000, // 2 SOL
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    // Confirming the stake
    const [userStakePDA] = PublicKey.findProgramAddressSync( 
      [staker.publicKey.toBuffer()],
      vestingProgram.programId,
    )

    // First deposit of 0.2 SOL
    await vestingProgram.methods
      .stake(stakeAmount)
      .accounts({
        staker: staker.publicKey,
      })
      .signers([staker])
      .rpc();

    let userPDAState = await vestingProgram.account.userStake.fetch(userStakePDA);
    expect(userPDAState.amount.toNumber()).toEqual(stakeAmount.toNumber());   // Confirming stake balance is 0.2 SOL

    // Second deposit of 0.2 SOL
    await vestingProgram.methods
    .stake(stakeAmount)
    .accounts({
      staker: staker.publicKey,
    })
    .signers([staker])
    .rpc();

  userPDAState = await vestingProgram.account.userStake.fetch(userStakePDA);
  expect(userPDAState.amount.toNumber()).toEqual(stakeAmount.toNumber() * 2); // Confirming stake balance is 0.4 SOL
  });

  it("Unstake SOL for unprivledged user", async () => {
    const stakeAmount = new BN(1e9);
    let staker = anchor.web3.Keypair.generate();

    // Have to initialize global state first
    await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    // Funding staker
    await context.setAccount(staker.publicKey, {
      lamports: 2_000_000_000, // 2 SOL
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    const tx = await vestingProgram.methods
      .stake(stakeAmount)
      .accounts({
        staker: staker.publicKey,
      })
      .signers([staker])
      .rpc();

    expect(tx.length).toBeGreaterThan(0);  

    // Confirming the stake
    const [userStakePDA] = PublicKey.findProgramAddressSync( 
      [staker.publicKey.toBuffer()],
      vestingProgram.programId,
    )
    let userPDAState = await vestingProgram.account.userStake.fetch(userStakePDA);
    expect(userPDAState.staker).toEqual(staker.publicKey);
    expect(userPDAState.amount.toNumber()).toEqual(stakeAmount.toNumber());

    await vestingProgram.methods
      .unstake(stakeAmount)
      .accounts({
        staker: staker.publicKey,
      })
      .signers([staker])
      .rpc();

    userPDAState = await vestingProgram.account.userStake.fetch(userStakePDA);
    expect(userPDAState.staker).toEqual(staker.publicKey);
    expect(userPDAState.amount.toNumber()).toEqual(0);
  });

  it("Unstake SOL invalid amount", async () => {
    const stakeAmount = new BN(0);
    let staker = anchor.web3.Keypair.generate();

    // Have to initialize global state first
    await vestingProgram.methods
      .initialize(dummyMint)
      .accounts({
        signer: keypair.publicKey,
      })
      .signers([keypair])
      .rpc();

    // Funding staker
    await context.setAccount(staker.publicKey, {
      lamports: 2_000_000_000, // 2 SOL
      data: Buffer.alloc(0),
      owner: SystemProgram.programId,
      executable: false,
    });

    await expect(vestingProgram.methods
      .unstake(stakeAmount)
      .accounts({
        staker: staker.publicKey,
      })
      .signers([staker])
      .rpc()).rejects.toThrow(IDL.errors[4].msg); // InvalidAmount
  });
});