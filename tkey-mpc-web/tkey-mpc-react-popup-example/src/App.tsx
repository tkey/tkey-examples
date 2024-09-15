import "./App.css";
import TorusUtils from "@toruslabs/torus.js";
import { getPubKeyPoint } from "@tkey-mpc/common-types";
import BN from "bn.js";
import { generatePrivate } from "eccrypto";
import { useEffect, useState } from "react";
import swal from "sweetalert";
import { tKey } from "./tkey";
import { addFactorKeyMetadata, setupWeb3, copyExistingTSSShareForNewFactor, addNewTSSShareAndFactor, getEcCrypto, LoginResponse, SigningParams } from "./utils";

import { ShareSerializationModule } from "@tkey-mpc/share-serialization";
import Web3 from "web3";
import { TorusServiceProvider } from "@tkey-mpc/service-provider-torus";
import { TorusLoginResponse } from "@toruslabs/customauth"
import { CustomChainConfig } from "@web3auth/base";

const uiConsole = (...args: any[]): void => {
  const el = document.querySelector("#console>p");
  if (el) {
    el.innerHTML = JSON.stringify(args || {}, null, 2);
  }
  console.log(...args);
};

const chainConfig: Omit<CustomChainConfig, "chainNamespace"> = {
  chainId: '0x1',
  rpcTarget: 'https://rpc.ankr.com/eth',
  displayName: 'mainnet',
  blockExplorer: 'https://etherscan.io/',
  ticker: 'ETH',
  tickerName: 'Ethereum',
}

function App() {
  const [loginResponse, setLoginResponse] = useState<LoginResponse | null>(null);
  const [user, setUser] = useState<any>(null);
  const [metadataKey, setMetadataKey] = useState<string | null>(null);
  const [localFactorKey, setLocalFactorKey] = useState<BN | null>(null);
  const [oAuthShare, setOAuthShare] = useState<BN | null>(null);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [signingParams, setSigningParams] = useState<SigningParams | null>(null);

  useEffect(() => {
    const init = async () => {
      // Initialization of Service Provider
      try {
        await (tKey.serviceProvider as TorusServiceProvider).init({});
      } catch (error) {
        console.error(error);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!localFactorKey) return;
    localStorage.setItem(
      `tKeyLocalStore\u001c${loginResponse!.userInfo.verifier}\u001c${loginResponse!.userInfo.verifierId}`,
      JSON.stringify({
        factorKey: localFactorKey.toString("hex"),
        verifier: loginResponse!.userInfo.verifier,
        verifierId: loginResponse!.userInfo.verifierId,
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFactorKey]);

  // sets up web3
  useEffect(() => {
    const localSetup = async () => {
      const { nodeIndexes } = await (tKey.serviceProvider as TorusServiceProvider).getTSSPubKey(
        tKey.tssTag,
        tKey?.metadata?.tssNonces?.[tKey.tssTag || "default"] || 0
      );
      const web3Local = await setupWeb3(chainConfig, loginResponse!, signingParams!, nodeIndexes as any);
      setWeb3(web3Local);
    };
    if (signingParams) {
      localSetup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signingParams]);

  const triggerLogin = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    try {
      // Triggering Login using Service Provider ==> opens the popup
      const loginRes = await (tKey.serviceProvider as TorusServiceProvider).triggerLogin({
        typeOfLogin: 'google',
        verifier: 'w3a-google-demo',
        clientId:
          '519228911939-cri01h55lsjbsia1k7ll6qpalrus75ps.apps.googleusercontent.com',
      });

      setUser(loginRes.userInfo);
      return loginRes;
    } catch (error) {
      uiConsole(error);
    }
  };

  const initializeNewKey = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    try {
      const loginRes: TorusLoginResponse | undefined = await triggerLogin(); // Calls the triggerLogin() function above

      if (!loginRes) {
        throw new Error("Login response not found");
      }
      
      const OAuthShare: BN = new BN(TorusUtils.getPostboxKey(loginRes), "hex");
      setOAuthShare(OAuthShare);
      //@ts-ignore
      const signatures: string[] = loginRes.sessionData.sessionTokenData.filter(i => Boolean(i)).map((session) => JSON.stringify({ data: session.token, sig: session.signature }));


      const loginResponse: LoginResponse = {
        userInfo: loginRes.userInfo,
        verifier: loginRes.userInfo.verifier,
        verifier_id: loginRes.userInfo.verifierId,
        signatures,
        OAuthShare,
      }

      console.log("loginResponse", loginResponse);

      setLoginResponse(loginResponse);
      const tKeyLocalStoreString = localStorage.getItem(`tKeyLocalStore\u001c${loginResponse.verifier}\u001c${loginResponse.verifier_id}`);
      const tKeyLocalStore = JSON.parse(tKeyLocalStoreString || "{}");

      let factorKey: BN | null = null;

      const existingUser = await isMetadataPresent(OAuthShare);

      if (!existingUser) {
        factorKey = new BN(generatePrivate());
        const deviceTSSShare = new BN(generatePrivate());
        const deviceTSSIndex = 2;
        const factorPub = getPubKeyPoint(factorKey);
        await tKey.initialize({ useTSS: true, factorPub, deviceTSSShare, deviceTSSIndex });
      } else {
        if (tKeyLocalStore.verifier === loginResponse.verifier && tKeyLocalStore.verifierId === loginResponse.verifier_id) {
          factorKey = new BN(tKeyLocalStore.factorKey, "hex");
        }
        else {
          try {
            factorKey = await swal('Enter your backup share', {
              content: 'input' as any,
            }).then(async value => {
              uiConsole(value);
              return await (tKey.modules.shareSerialization as ShareSerializationModule).deserialize(value, "mnemonic");
            });
          } catch (error) {
            uiConsole(error);
            throw new Error("Invalid backup share");
          }
        }
        if (factorKey === null) throw new Error("Backup share not found");
        const factorKeyMetadata = await tKey.storageLayer.getMetadata<{
          message: string;
        }>({
          privKey: factorKey,
        });
        if (factorKeyMetadata.message === "KEY_NOT_FOUND") {
          throw new Error("no metadata for your factor key, reset your account");
        }

        const metadataShare = JSON.parse(factorKeyMetadata.message);
        if (!metadataShare.deviceShare || !metadataShare.tssShare) throw new Error("Invalid data from metadata");
        uiConsole("Metadata Share:", metadataShare.deviceShare, "Index:", metadataShare.tssIndex);
        const metadataDeviceShare = metadataShare.deviceShare;
        await tKey.initialize({ neverInitializeNewKey: true });
        await tKey.inputShareStoreSafe(metadataDeviceShare, true);
        await tKey.reconstructKey();
      }

      // Checks the requiredShares to reconstruct the tKey, starts from 2 by default and each of the above share reduce it by one.
      const { requiredShares } = tKey.getKeyDetails();
      if (requiredShares > 0) {
        throw new Error(`Threshold not met. Required Share: ${requiredShares}. You should reset your account.`);
      }
      // 2. Reconstruct the Metadata Key
      const metadataKey = await tKey.reconstructKey();
      setMetadataKey(metadataKey?.privKey.toString("hex"));

      const tssNonce: number = tKey.metadata.tssNonces![tKey.tssTag];
      // tssShare1 = TSS Share from the social login/ service provider
      const tssShare1PubKeyDetails = await tKey.serviceProvider.getTSSPubKey(tKey.tssTag, tssNonce);

      const tssShare1PubKey = { x: tssShare1PubKeyDetails.pubKey.x.toString("hex"), y: tssShare1PubKeyDetails.pubKey.y.toString("hex") };

      // tssShare2 = TSS Share from the local storage of the device
      const { tssShare: tssShare2, tssIndex: tssShare2Index } = await tKey.getTSSShare(factorKey);

      const ec = getEcCrypto()
      const tssShare2ECPK = ec.curve.g.mul(tssShare2);
      const tssShare2PubKey = { x: tssShare2ECPK.getX().toString("hex"), y: tssShare2ECPK.getY().toString("hex") };


      // 4. derive tss pub key, tss pubkey is implicitly formed using the dkgPubKey and the userShare (as well as userTSSIndex)
      const tssPubKey = tKey.getTSSPub();

      const compressedTSSPubKey = Buffer.from(`${tssPubKey.x.toString(16, 64)}${tssPubKey.y.toString(16, 64)}`, "hex");

      // 5. save factor key and other metadata
      if (
        !existingUser ||
        !(tKeyLocalStore.verifier === loginResponse.verifier && tKeyLocalStore.verifierId === loginResponse.verifier_id)
      ) {
        await addFactorKeyMetadata(tKey, factorKey, tssShare2, tssShare2Index, "local storage share");
      }
      await tKey.syncLocalMetadataTransitions();

      setLocalFactorKey(factorKey);

      const nodeDetails = await tKey.serviceProvider.getTSSNodeDetails()

      setSigningParams({
        tssNonce,
        tssShare2,
        tssShare2Index,
        compressedTSSPubKey,
        signatures,
        nodeDetails,
      })


      uiConsole(
        "Successfully logged in & initialised MPC TKey SDK",
        "TSS Public Key: ",
        tKey.getTSSPub(),
        "Metadata Key",
        metadataKey.privKey.toString("hex"),
        "With Factors/Shares:",
        tKey.getMetadata().getShareDescription(),
      );
    } catch (error) {
      uiConsole(error, "caught");
    }
  };

  const isMetadataPresent = async (privateKeyBN: BN) => {
    const metadata = (await tKey.storageLayer.getMetadata({ privKey: privateKeyBN }));
    if (
      metadata &&
      Object.keys(metadata).length > 0 &&
      (metadata as any).message !== 'KEY_NOT_FOUND'
    ) {
      return true;
    } else {
      return false;
    }
  }

  const copyTSSShareIntoManualBackupFactorkey = async () => {
    try {
      if (!tKey) {
        throw new Error("tkey does not exist, cannot add factor pub");
      }
      if (!localFactorKey) {
        throw new Error("localFactorKey does not exist, cannot add factor pub");
      }

      const backupFactorKey = new BN(generatePrivate());
      const backupFactorPub = getPubKeyPoint(backupFactorKey);

      await copyExistingTSSShareForNewFactor(tKey, backupFactorPub, localFactorKey);

      const { tssShare: tssShare2, tssIndex: tssIndex2 } = await tKey.getTSSShare(localFactorKey);
      await addFactorKeyMetadata(tKey, backupFactorKey, tssShare2, tssIndex2, "manual share");
      const serializedShare = await (tKey.modules.shareSerialization as ShareSerializationModule).serialize(backupFactorKey, "mnemonic");
      await tKey.syncLocalMetadataTransitions();
      uiConsole("Successfully created manual backup. Manual Backup Factor: ", serializedShare)

    } catch (err) {
      uiConsole(`Failed to copy share to new manual factor: ${err}`)
    }
  }

  const createNewTSSShareIntoManualBackupFactorkey = async () => {
    try {
      if (!tKey) {
        throw new Error("tkey does not exist, cannot add factor pub");
      }
      if (!localFactorKey) {
        throw new Error("localFactorKey does not exist, cannot add factor pub");
      }

      const backupFactorKey = new BN(generatePrivate());
      const backupFactorPub = getPubKeyPoint(backupFactorKey);
      const tKeyShareDescriptions = await tKey.getMetadata().getShareDescription();
      let backupFactorIndex = 2;
      for (const [key, value] of Object.entries(tKeyShareDescriptions)) {
        // eslint-disable-next-line no-loop-func, array-callback-return
        value.map((factor: any) => {
          factor = JSON.parse(factor);
          if (factor.tssShareIndex > backupFactorIndex) {
            backupFactorIndex = factor.tssShareIndex;
          }
        });
      }
      uiConsole("backupFactorIndex:", backupFactorIndex + 1);
      await addNewTSSShareAndFactor(tKey, backupFactorPub, backupFactorIndex + 1, localFactorKey, signingParams!.signatures);

      const { tssShare: tssShare2, tssIndex: tssIndex2 } = await tKey.getTSSShare(backupFactorKey);
      await addFactorKeyMetadata(tKey, backupFactorKey, tssShare2, tssIndex2, "manual share");
      const serializedShare = await (tKey.modules.shareSerialization as ShareSerializationModule).serialize(backupFactorKey, "mnemonic");

      await tKey.syncLocalMetadataTransitions();
      uiConsole(" Successfully created manual backup.Manual Backup Factor: ", serializedShare);

    } catch (err) {
      uiConsole(`Failed to create new manual factor ${err}`);
    }
  }

  const deleteTkeyLocalStore = async () => {
    localStorage.removeItem(`tKeyLocalStore\u001c${loginResponse!.verifier}\u001c${loginResponse!.verifier_id}`);
    uiConsole("Successfully deleted tKey local store");
  }

  const keyDetails = async () => {
    if (!tKey) {
      uiConsole("tKey not initialized yet");
      return;
    }
    // const keyDetails = await tKey.getKeyDetails();


    uiConsole(
      "TSS Public Key: ",
      tKey.getTSSPub(),
      "With Factors/Shares:",
      tKey.getMetadata().getShareDescription())
    // return keyDetails;
  };

  const logout = (): void => {
    uiConsole("Log out");
    setUser(null);
    setLoginResponse(null);
  };

  const getUserInfo = (): void => {
    uiConsole(user);
    return user;
  };

  const getLoginResponse = (): LoginResponse => {
    uiConsole(loginResponse);
    return loginResponse!;
  };

  const getMetadataKey = (): string => {
    uiConsole(metadataKey);
    return metadataKey!;
  };

  const resetAccount = async () => {
    try {
      localStorage.removeItem(`tKeyLocalStore\u001c${loginResponse!.verifier}\u001c${loginResponse!.verifier_id}`);
      await tKey.storageLayer.setMetadata({
        privKey: oAuthShare!,
        input: { message: "KEY_NOT_FOUND" },
      });
      uiConsole("Reset Account Successful.");
      setUser(null);
    } catch (e) {
      uiConsole(e);
    }
  };

  const getChainID = async () => {
    if (!web3) {
      console.log("web3 not initialized yet");
      return;
    }
    const chainId = await web3.eth.getChainId();
    uiConsole(chainId);
    return chainId;
  };

  const ethSign = async () => {
    if (!web3) {
      console.log("web3 not initialized yet");
      return;
    }
    const accounts = await web3.eth.getAccounts();
    const account = accounts[0];
    const msg = "hi there";
    const signedMessage = await web3.eth.personal.sign(
          msg,
          account,
          "",
        );
    uiConsole(signedMessage);
    return signedMessage;
  };

  const getAccounts = async () => {
    if (!web3) {
      console.log("web3 not initialized yet");
      return;
    }
    const address = (await web3.eth.getAccounts())[0];
    uiConsole(address);
    return address;
  };

  const getBalance = async () => {
    if (!web3) {
      console.log("web3 not initialized yet");
      return;
    }
    const address = (await web3.eth.getAccounts())[0];
    const balance = web3.utils.fromWei(
      await web3.eth.getBalance(address) // Balance is in wei
    );
    uiConsole(balance);
    return balance;
  };

  const signMessage = async (): Promise<any> => {
    if (!web3) {
      console.log("web3 not initialized yet");
      return;
    }
    const fromAddress = (await web3.eth.getAccounts())[0];
    const originalMessage = "hi there";
    const params = [originalMessage, fromAddress];
    const method = "personal_sign";
    const signedMessage = await (web3.currentProvider as any)?.sendAsync({
      id: 1,
      method,
      params,
      fromAddress,
    });
    uiConsole(signedMessage);
  };

  const sendTransaction = async () => {
    if (!web3) {
      console.log("web3 not initialized yet");
      return;
    }
    const fromAddress = (await web3.eth.getAccounts())[0];

    const destination = "0x2E464670992574A613f10F7682D5057fB507Cc21";
    const amount = web3.utils.toWei("0.0001"); // Convert 1 ether to wei

    // Submit transaction to the blockchain and wait for it to be mined
    uiConsole("Sending transaction...");
    const receipt = await web3.eth.sendTransaction({
      from: fromAddress,
      to: destination,
      value: amount,
    });
    uiConsole(receipt);
  };

  const loggedInView = (
    <>
      <h2 className="subtitle">Account Details</h2>
      <div className="flex-container">

        <button onClick={getUserInfo} className="card">
          Get User Info
        </button>


        <button onClick={getLoginResponse} className="card">
          See Login Response
        </button>


        <button onClick={keyDetails} className="card">
          Key Details
        </button>


        <button onClick={getMetadataKey} className="card">
          Metadata Key
        </button>


        <button onClick={logout} className="card">
          Log Out
        </button>

      </div>
      <h2 className="subtitle">Recovery/ Key Manipulation</h2>
      <div className="flex-container">

        <button onClick={copyTSSShareIntoManualBackupFactorkey} className="card">
          Copy Existing TSS Share For New Factor Manual
        </button>


        <button onClick={createNewTSSShareIntoManualBackupFactorkey} className="card">
          Create New TSSShare Into Manual Backup Factor
        </button>


        <button onClick={deleteTkeyLocalStore} className="card">
          Delete tKey Local Store (enables Recovery Flow)
        </button>


        <button onClick={resetAccount} className='card'>
          Reset Account (CAUTION)
        </button>

      </div>
      <h2 className="subtitle">Blockchain Calls</h2>
      <div className="flex-container">

        <button onClick={getChainID} className="card">
          Get Chain ID
        </button>


        <button onClick={getAccounts} className="card">
          Get Accounts
        </button>

        <button onClick={ethSign} className="card">
          sign eth message
        </button>


        <button onClick={getBalance} className="card">
          Get Balance
        </button>



        <button onClick={signMessage} className="card">
          Sign Message
        </button>


        <button onClick={sendTransaction} className="card">
          Send Transaction
        </button>

      </div>


    </>
  );

  const unloggedInView = (
      <button onClick={() => initializeNewKey()} className="card">
        Login
      </button>
  );

  return (
    <div className="container">
      <h1 className="title">
        <a target="_blank" href="https://web3auth.io/docs/guides/mpc" rel="noreferrer">
          Web3Auth Core Kit tKey MPC
        </a> {" "}
        & Popup Flow Ethereum Example
      </h1>

      <div className="grid">{user ? loggedInView : unloggedInView}</div>
      <div id="console" style={{ whiteSpace: "pre-line" }}>
        <p style={{ whiteSpace: "pre-line" }}></p>
      </div>
      <footer className="footer">
        <a href="https://github.com/Web3Auth/web3auth-core-kit-examples/tree/main/mpc-core-kit/tkey-mpc-react-popup-example" target="_blank" rel="noopener noreferrer">
          Source code
        </a>
      </footer>
    </div>
  );
}

export default App;
