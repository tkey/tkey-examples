import BN from "bn.js";
import { encrypt, getPubKeyECC, Point, PointHex, randomSelection, ShareStore } from "@tkey-mpc/common-types";
import EC from "elliptic";

import { generatePrivate } from "@toruslabs/eccrypto";
import * as tss from "@toruslabs/tss-lib";
import { EthereumSigningProvider } from "@web3auth-mpc/ethereum-provider";
import keccak256 from "keccak256";
import Web3 from "web3";
import type { provider } from "web3-core";
import { Client, getDKLSCoeff, setupSockets } from "@toruslabs/tss-client";

import { CustomChainConfig } from "@web3auth/base";
import ThresholdKey from "@tkey-mpc/core/dist/types/core";

export type LoginResponse = {
  userInfo: any,
  verifier: string,
  verifier_id: string,
  signatures : string[],
  OAuthShare: BN,
}

export type SigningParams = {
  tssNonce: number,
  tssShare2: BN,
  tssShare2Index: number,
  compressedTSSPubKey: Buffer,
  signatures: string[],
  nodeDetails : {
    serverEndpoints: string[];
    serverPubKeys: PointHex[];
    serverThreshold: number;
  },
}

const parties = 4;
const clientIndex = parties - 1;
const tssImportUrl = `https://sapphire-dev-2-2.authnetwork.dev/tss/v1/clientWasm`;

const DELIMITERS = {
  Delimiter1: "\u001c",
  Delimiter2: "\u0015",
  Delimiter3: "\u0016",
  Delimiter4: "\u0017",
};


export function getEcCrypto(): EC.ec {
  // eslint-disable-next-line new-cap
  return new EC.ec("secp256k1");
}
const ec = getEcCrypto();

export const generateTSSEndpoints = (tssNodeEndpoints: string[], parties: number, clientIndex: number) => {
  const endpoints: string[] = [];
  const tssWSEndpoints: string[] = [];
  const partyIndexes: number[] = [];
  const nodeIndexesReturned: number[] = [];

  for (let i = 0; i < parties; i++) {
    partyIndexes.push(i);
    if (i === clientIndex) {
      endpoints.push(null as any);
      tssWSEndpoints.push(null as any);
    } else {
      endpoints.push(tssNodeEndpoints[i]);
      tssWSEndpoints.push(new URL(tssNodeEndpoints[i]).origin);
      nodeIndexesReturned.push(+tssNodeEndpoints[i]);
    }
  }
  return { endpoints, tssWSEndpoints, partyIndexes, nodeIndexesReturned };
};


export const generateTSSEndpointsNew = (tssNodeEndpoints: string[], parties: number, clientIndex: number, nodeIndexes: number[]) => {
  const endpoints: string[] = [];
  const tssWSEndpoints: string[] = [];
  const partyIndexes: number[] = [];
  const nodeIndexesReturned: number[] = [];

  for (let i = 0; i < parties; i++) {
    partyIndexes.push(i);
    if (i === clientIndex) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      endpoints.push(null as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tssWSEndpoints.push(null as any);
    } else {
      const targetNodeIndex = nodeIndexes[i] - 1;
      endpoints.push(tssNodeEndpoints[targetNodeIndex]);
      tssWSEndpoints.push(new URL(tssNodeEndpoints[targetNodeIndex]).origin);
      nodeIndexesReturned.push(nodeIndexes[i]);
    }
  }
  return { endpoints, tssWSEndpoints, partyIndexes, nodeIndexesReturned };
};
export function scalarBNToBufferSEC1(s: BN): Buffer {
  return s.toArrayLike(Buffer, "be", 32);
}

export const setupWeb3 = async (chainConfig: Omit<CustomChainConfig, "chainNamespace">, loginReponse: LoginResponse, signingParams: SigningParams, nodeIndexes: number[]) => {
  try {
    const ethereumSigningProvider = new EthereumSigningProvider({
      config: {
        chainConfig
      }
    });

    const { tssNonce, tssShare2, tssShare2Index, compressedTSSPubKey, signatures, nodeDetails } = signingParams;

    const { verifier, verifier_id: verifierId } = loginReponse;

    const vid = `${verifier}${DELIMITERS.Delimiter1}${verifierId}`;
    const sessionId = `${vid}${DELIMITERS.Delimiter2}default${DELIMITERS.Delimiter3}${tssNonce}${DELIMITERS.Delimiter4}`;


    /*
    pass user's private key here.
    after calling setupProvider, we can use
    */
    const sign = async (msgHash: Buffer) => {


      const randomSessionNonce = keccak256(generatePrivate().toString("hex") + Date.now());

      // session is needed for authentication to the web3auth infrastructure holding the factor 1
      const currentSession = `${sessionId}${randomSessionNonce.toString("hex")}`;

      // 1. setup
      // generate endpoints for servers
     
      const { endpoints, tssWSEndpoints, partyIndexes, nodeIndexesReturned: participatingServerDKGIndexes } = generateTSSEndpointsNew(nodeDetails.serverEndpoints, parties, clientIndex, nodeIndexes);
  
      // setup mock shares, sockets and tss wasm files.
      const [sockets] = await Promise.all([setupSockets(tssWSEndpoints as string[], randomSessionNonce.toString("hex")), tss.default(tssImportUrl)]);

      const dklsCoeff = getDKLSCoeff(true, participatingServerDKGIndexes, tssShare2Index);
      const denormalisedShare = dklsCoeff.mul(tssShare2).umod(ec.curve.n);
      // const share = Buffer.from(denormalisedShare.toString(16, 64), "hex").toString("base64");
      const share = scalarBNToBufferSEC1(denormalisedShare).toString("base64");

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
        compressedTSSPubKey.toString("base64"),
        true,
        tssImportUrl
      );
      const serverCoeffs: any = {};
      for (let i = 0; i < participatingServerDKGIndexes.length; i++) {
        const serverIndex = participatingServerDKGIndexes[i];
        serverCoeffs[serverIndex] = getDKLSCoeff(false, participatingServerDKGIndexes, tssShare2Index, serverIndex).toString("hex");
      }
      client.precompute(tss, { signatures, server_coeffs: serverCoeffs, nonce: scalarBNToBufferSEC1(new BN(0)).toString("base64") });
      await client.ready();
      let { r, s, recoveryParam } = await client.sign(tss as any, Buffer.from(msgHash).toString("base64"), true, "", "keccak256", {
        signatures,
      });
      if (recoveryParam < 27) {
        recoveryParam += 27;
      }
      await client.cleanup(tss, { signatures, server_coeffs: serverCoeffs });
      return { v: recoveryParam, r: r.toArrayLike(Buffer, "be", 32), s: s.toArrayLike(Buffer, "be", 32) };
    };

    if (!compressedTSSPubKey) {
      throw new Error(`compressedTSSPubKey does not exist ${compressedTSSPubKey}`);
    }

    const getPublic: () => Promise<Buffer> = async () => {
      return compressedTSSPubKey;
    };

    await ethereumSigningProvider.setupProvider({ sign, getPublic });
    console.log(ethereumSigningProvider.provider);
    const web3 = new Web3(ethereumSigningProvider.provider as provider);
    return web3;
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

export const gettKeyLocalStore = (loginResponse: LoginResponse) => {
  return JSON.parse(localStorage.getItem(`tKeyLocalStore\u001c${loginResponse.verifier}\u001c${loginResponse.verifier_id}`) || "{}");
}

export const settKeyLocalStore = (loginResponse: LoginResponse, localFactorKey: BN) => {
  localStorage.setItem(`tKeyLocalStore\u001c${loginResponse.verifier}\u001c${loginResponse.verifier_id}`, JSON.stringify({
    factorKey: localFactorKey.toString("hex"),
    verifier: loginResponse.verifier,
    verifierId: loginResponse.verifier_id,
  }));
}

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

export const addNewTSSShareAndFactor = async (tKey: ThresholdKey, newFactorPub: Point, newFactorTSSIndex: number, factorKeyForExistingTSSShare: BN, signatures: string[]) => {
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
    const existingTSSIndexes = existingFactorPubs.map((fb: Point) => tKey.getFactorEncs(fb).tssIndex);
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
  }
  catch(err) {
    console.error(err);
    throw err;
  }
};