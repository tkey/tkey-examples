import BN from "bn.js";
import { encrypt, getPubKeyECC, Point, randomSelection, ShareStore } from "@tkey-mpc/common-types";
import EC from "elliptic";

import { generatePrivate } from "@toruslabs/eccrypto";
import { Client } from "@toruslabs/tss-client";
import * as tss from "@toruslabs/tss-lib";
import keccak256 from "keccak256";
import { utils } from "@toruslabs/tss-client";
import { Signer, SignerAsync } from "bitcoinjs-lib";
import { testnet } from "bitcoinjs-lib/src/networks";
import ThresholdKey from "@tkey-mpc/core/dist/types/core";
const { getDKLSCoeff, setupSockets } = utils;

const parties = 4;
const clientIndex = parties - 1;
const tssImportUrl = `https://sapphire-dev-2-2.authnetwork.dev/tss/v1/clientWasm`;

export type SigningParams = {
  oAuthShare: string;
  factorKey: string;
  btcAddress: string;
  ecPublicKey: string;
  tssNonce: number;
  tssShare2: string;
  tssShare2Index: number;
  tssPubKey: string;
  signatures: string[];
  userInfo: any;
  nodeDetails: any;
};


const DELIMITERS = {
  Delimiter1: "\u001c",
  Delimiter2: "\u0015",
  Delimiter3: "\u0016",
  Delimiter4: "\u0017",
};

export function getEcCrypto(): any {
  // eslint-disable-next-line new-cap
  return new EC.ec("secp256k1");
}
const ec = getEcCrypto();

export const generateTSSEndpoints = (tssNodeEndpoints: string[], parties: number, clientIndex: number) => {
  const endpoints: string[] = [];
  const tssWSEndpoints: string[] = [];
  const partyIndexes: number[] = [];
  for (let i = 0; i < parties; i++) {
    partyIndexes.push(i);
    if (i === clientIndex) {
      endpoints.push(null as any);
      tssWSEndpoints.push(null as any);
    } else {
      endpoints.push(tssNodeEndpoints[i]);
      tssWSEndpoints.push(new URL(tssNodeEndpoints[i]).origin);
    }
  }
  return { endpoints, tssWSEndpoints, partyIndexes };
};

export const setupWeb3 = async (loginReponse: any, signingParams: SigningParams) => {
  try {
    const { tssNonce, tssShare2, tssShare2Index, tssPubKey, signatures, ecPublicKey, nodeDetails } = signingParams;
    const tssShare2BN = new BN(tssShare2, 16);

    const { verifier, verifierId } = loginReponse.userInfo;

    const vid = `${verifier}${DELIMITERS.Delimiter1}${verifierId}`;
    const sessionId = `${vid}${DELIMITERS.Delimiter2}default${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}`;

    /*
    pass user's private key here.
    after calling setupProvider, we can use
    */
    const sign = async (hash: Buffer, lowR?: boolean | undefined) => {
      const randomSessionNonce = keccak256(generatePrivate().toString("hex") + Date.now());

      // session is needed for authentication to the web3auth infrastructure holding the factor 1
      const currentSession = `${sessionId}${randomSessionNonce.toString("hex")}`;

      // 1. setup
      // generate endpoints for servers
      const { endpoints, tssWSEndpoints, partyIndexes } = generateTSSEndpoints(nodeDetails.serverEndpoints, parties, clientIndex);

      // setup mock shares, sockets and tss wasm files.
      const [sockets] = await Promise.all([setupSockets(tssWSEndpoints as string[], randomSessionNonce.toString("hex")), tss.default(tssImportUrl)]);

      const participatingServerDKGIndexes = [1, 2, 3];
      const dklsCoeff = getDKLSCoeff(true, participatingServerDKGIndexes, tssShare2Index);
      const denormalisedShare = dklsCoeff.mul(tssShare2BN).umod(ec.curve.n);
      const share = Buffer.from(denormalisedShare.toString(16, 64), "hex").toString("base64");

      if (!currentSession) {
        throw new Error(`sessionAuth does not exist ${currentSession}`);
      }
      if (!signatures) {
        throw new Error(`Signature does not exist ${signatures}`);
      }

      const client = new Client(
        currentSession,
        clientIndex,
        partyIndexes,
        endpoints,
        sockets,
        share,
        Buffer.from(tssPubKey, "hex").toString("base64"),
        true,
        tssImportUrl
      );
      const serverCoeffs: any = {};
      for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
        const serverIndex = participatingServerDKGIndexes[i];
        serverCoeffs[serverIndex] = getDKLSCoeff(false, participatingServerDKGIndexes, tssShare2Index, serverIndex).toString("hex");
      }
      // debugger;
      client.precompute(tss, { signatures, server_coeffs: serverCoeffs });
      console.log("client is ready");
      await client.ready();
      const { r, s, recoveryParam } = await client.sign(tss as any, Buffer.from(hash).toString("base64"), true, "", "keccak256", {
        signatures,
      });
      await client.cleanup(tss, { signatures, server_coeffs: serverCoeffs });
      const sig = { v: recoveryParam, r: r.toArrayLike(Buffer, "be", 32), s: s.toArrayLike(Buffer, "be", 32) };
      const sigBuffer = Buffer.concat([sig.r, sig.s]);
      return Promise.resolve(sigBuffer);
    };

    if (!tssPubKey) {
      throw new Error(`compressedTSSPubKey does not exist ${tssPubKey}`);
    }

    const toAsyncSigner = (signer: Signer): SignerAsync => {
      const ret: SignerAsync = {
        publicKey: signer.publicKey,
        sign: (hash: Buffer, lowR?: boolean | undefined): Promise<Buffer> => {
          return new Promise((resolve, rejects): void => {
            // setTimeout(() => {
            try {
              // debugger;
              const r = signer.sign(hash, lowR);
              resolve(r);
            } catch (e) {
              rejects(e);
            }
            // }, 10);
          });
        },
        network: testnet,
      };
      return ret;
    };

    const btcSigner = toAsyncSigner({ publicKey: Buffer.from(ecPublicKey, "hex"), sign: sign as any });
    return btcSigner;
    // await ethereumSigningProvider.setupProvider({ sign, getPublic });
    // // console.log(ethereumSigningProvider.provider);
    // const web3 = new Web3(ethereumSigningProvider.provider as provider);
    // return web3;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export type FactorKeyCloudMetadata = {
  deviceShare: ShareStore;
  tssShare: BN;
  tssIndex: number;
};

const fetchDeviceShareFromTkey = async (tKey: ThresholdKey) => {
  if (!tKey) {
    console.error("tKey not initialized yet");
    return;
  }
  try {
    const polyId = tKey.metadata.getLatestPublicPolynomial().getPolynomialID();
    const shares = tKey.shares[polyId];
    let deviceShare: ShareStore | null = null;

    for (const shareIndex in shares) {
      if (shareIndex !== "1") {
        deviceShare = shares[shareIndex];
      }
    }
    return deviceShare;
  } catch (err: any) {
    console.error({ err });
    throw new Error(err);
  }
};

export const addFactorKeyMetadata = async (tKey: ThresholdKey, factorKey: BN, tssShare: BN, tssIndex: number, factorKeyDescription: string) => {
  if (!tKey) {
    console.error("tKey not initialized yet");
    return;
  }
  const { requiredShares } = tKey.getKeyDetails();
  if (requiredShares > 0) {
    console.error("not enough shares for metadata key");
  }

  const metadataDeviceShare = await fetchDeviceShareFromTkey(tKey);

  const factorIndex = getPubKeyECC(factorKey).toString("hex");
  const metadataToSet: FactorKeyCloudMetadata = {
    deviceShare: metadataDeviceShare as ShareStore,
    tssShare,
    tssIndex,
  };

  // Set metadata for factor key backup
  await tKey.addLocalMetadataTransitions({
    input: [{ message: JSON.stringify(metadataToSet) }],
    privKey: [factorKey],
  });

  // also set a description on tkey
  const params = {
    module: factorKeyDescription,
    dateAdded: Date.now(),
    tssShareIndex: tssIndex,
  };
  await tKey.addShareDescription(factorIndex, JSON.stringify(params), true);
};

export const copyExistingTSSShareForNewFactor = async (tKey: ThresholdKey, newFactorPub: Point, factorKeyForExistingTSSShare: BN) => {
  if (!tKey) {
    throw new Error("tkey does not exist, cannot copy factor pub");
  }
  if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
    throw new Error("factorPubs does not exist, failed in copy factor pub");
  }
  if (!tKey.metadata.factorEncs || typeof tKey.metadata.factorEncs[tKey.tssTag] !== "object") {
    throw new Error("factorEncs does not exist, failed in copy factor pub");
  }

  const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag].slice();
  const updatedFactorPubs = existingFactorPubs.concat([newFactorPub]);
  const { tssShare, tssIndex } = await tKey.getTSSShare(factorKeyForExistingTSSShare);

  const factorEncs = JSON.parse(JSON.stringify(tKey.metadata.factorEncs[tKey.tssTag]));
  const factorPubID = newFactorPub.x.toString(16, 64);
  factorEncs[factorPubID] = {
    tssIndex,
    type: "direct",
    userEnc: await encrypt(
      Buffer.concat([
        Buffer.from("04", "hex"),
        Buffer.from(newFactorPub.x.toString(16, 64), "hex"),
        Buffer.from(newFactorPub.y.toString(16, 64), "hex"),
      ]),
      Buffer.from(tssShare.toString(16, 64), "hex")
    ),
    serverEncs: [],
  };
  tKey.metadata.addTSSData({
    tssTag: tKey.tssTag,
    factorPubs: updatedFactorPubs,
    factorEncs,
  });
};

export const addNewTSSShareAndFactor = async (
  tKey: ThresholdKey,
  newFactorPub: Point,
  newFactorTSSIndex: number,
  factorKeyForExistingTSSShare: BN,
  signatures: any
) => {
  try {
    if (!tKey) {
      throw new Error("tkey does not exist, cannot add factor pub");
    }
    if (!(newFactorTSSIndex === 2 || newFactorTSSIndex === 3)) {
      throw new Error("tssIndex must be 2 or 3");
    }
    if (!tKey.metadata.factorPubs || !Array.isArray(tKey.metadata.factorPubs[tKey.tssTag])) {
      throw new Error("factorPubs does not exist");
    }

    const existingFactorPubs = tKey.metadata.factorPubs[tKey.tssTag].slice();
    const updatedFactorPubs = existingFactorPubs.concat([newFactorPub]);
    const existingTSSIndexes = existingFactorPubs.map((fb: any) => tKey.getFactorEncs(fb).tssIndex);
    const updatedTSSIndexes = existingTSSIndexes.concat([newFactorTSSIndex]);
    const { tssShare, tssIndex } = await tKey.getTSSShare(factorKeyForExistingTSSShare);

    tKey.metadata.addTSSData({
      tssTag: tKey.tssTag,
      factorPubs: updatedFactorPubs,
    });

    const rssNodeDetails = await tKey._getRssNodeDetails();
    const { serverEndpoints, serverPubKeys, serverThreshold } = rssNodeDetails;
    const randomSelectedServers = randomSelection(
      new Array(rssNodeDetails.serverEndpoints.length).fill(null).map((_, i) => i + 1),
      Math.ceil(rssNodeDetails.serverEndpoints.length / 2)
    );

    const verifierNameVerifierId = tKey.serviceProvider.getVerifierNameVerifierId();
    await tKey._refreshTSSShares(true, tssShare, tssIndex, updatedFactorPubs, updatedTSSIndexes, verifierNameVerifierId, {
      selectedServers: randomSelectedServers,
      serverEndpoints,
      serverPubKeys,
      serverThreshold,
      authSignatures: signatures,
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
};
