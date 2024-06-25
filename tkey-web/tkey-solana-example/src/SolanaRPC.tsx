import { base64 } from "@scure/base";
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { CustomChainConfig, IProvider } from "@web3auth/base";
import { SolanaWallet } from "@web3auth/solana-provider";
import nacl from "tweetnacl";

export default class SolanaRPC {
    private solanaWallet: SolanaWallet;

    constructor(provider: IProvider) {
        this.solanaWallet = new SolanaWallet(provider);
    }

    async getAccount(): Promise<string> {
        try {
            const address = (await this.solanaWallet.requestAccounts())[0];
            const publicKey = new PublicKey(address);

            // Uncomment to verify the address is valid Solana Address
            // const isValidAddress = PublicKey.isOnCurve(publicKey.toBytes())
            // console.log(isValidAddress);
            return address;

        } catch (error) {
            return error as string;
        }
    }

    async getBalance(): Promise<string> {
        try {
            const address = (await this.solanaWallet.requestAccounts())[0];
            const publicKey = new PublicKey(address);

            const connectionConfig = await this.solanaWallet.request<string[], CustomChainConfig>({
                method: "solana_provider_config",
                params: [],
            });

            const connection = new Connection(connectionConfig.rpcTarget);
            let balanceResponse = await connection.getBalance(publicKey)
            return (balanceResponse / LAMPORTS_PER_SOL).toString();
        } catch (error) {
            return error as string;
        }
    }

    async sendTransaction(): Promise<string> {
        try {
            const address = (await this.solanaWallet.requestAccounts())[0];
            const publicKey = new PublicKey(address);

            const lamportsToSend = 1_000_000;
            const connectionConfig = await this.solanaWallet.request<string[], CustomChainConfig>({
                method: "solana_provider_config",
                params: [],
            });

            const connection = new Connection(connectionConfig.rpcTarget);
            const getRecentBlockhash = await connection.getLatestBlockhash("confirmed");
            const transferTransaction = new Transaction().add(
                // Self transfer tokens
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: publicKey,
                    lamports: lamportsToSend,
                }),
            );

            transferTransaction.recentBlockhash = getRecentBlockhash.blockhash;
            transferTransaction.feePayer = publicKey;


            const hash = await this.solanaWallet.signAndSendTransaction(transferTransaction);

            return hash.signature;
        } catch (error) {
            return error as string;
        }
    }

    async requestFaucet(): Promise<string> {
        try {
            const address = (await this.solanaWallet.requestAccounts())[0];
            const publicKey = new PublicKey(address);

            const connectionConfig = await this.solanaWallet.request<string[], CustomChainConfig>({
                method: "solana_provider_config",
                params: [],
            });

            const connection = new Connection(connectionConfig.rpcTarget);
            const hash = await connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
            return hash;
        } catch (error) {
            return error as string;
        }
    }

    async signMessage(): Promise<string> {
        try {
            const address = (await this.solanaWallet.requestAccounts())[0];
            const publicKey = new PublicKey(address);

            const msg = Buffer.from("Welcome to Web3Auth");
            const sig = await this.solanaWallet.signMessage(msg);

            // Verify signature
            const result = nacl.sign.detached.verify(
                msg,
                sig,
                publicKey.toBytes(),
            );

            console.log("Signature verification result:", result);
            // Return the base64 signature
            return base64.encode(sig);
        } catch (error) {
            return error as string;
        }
    }
}