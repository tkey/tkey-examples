//
//  ThresholdKeyViewModel.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import Foundation
import CustomAuth
import TorusUtils
import FetchNodeDetails
import CommonSources
import Web3SwiftMpcProvider
import web3
import CryptoSwift
import UIKit
import tkey_mpc_swift

class ThresholdKeyViewModel: ObservableObject {
    
    var userData: TorusKeyData
    var ethereumClient: EthereumClient!
    
    init(userData: TorusKeyData) {
        self.userData = userData
        ethereumClient = EthereumClient()
    }
    
    @Published var isAccounReady: Bool = false
    @Published var showAlert: Bool = false
    @Published var isTKeyInitialized: Bool = false
    @Published var factorPubs: [String]!
    @Published var isLoaderVisible: Bool = false
    @Published var securityQuestion: String = ""
    @Published var isReseted: Bool = false
    
    var verifier: String!
    var verifierId: String!
    var signatures: [[String: String]]!
    var torusUtils: TorusUtils!
    var nodeDetails: AllNodeDetailsModel!
    var tssEndPoints: Array<String>!
    var thresholdKey: ThresholdKey!
    var totalShares: Int!
    var threshold: Int!
    var requiredShares: Int!
    var keyDetails: KeyDetails!
    var address: String!
    var ethereumAccount: EthereumTssAccount!
    var activeFactor: String!
    
    var alertContent: String = ""
    
    func initialize() {
        Task {
            do {
                guard let finalKeyData = userData.torusKey.finalKeyData else {
                    showAlert(alertContent:"Failed to get public address from userinfo")
                    return
                }
                
                guard let verifierLocal = userData.userInfo["verifier"] as? String, let verifierIdLocal = userData.userInfo["verifierId"] as? String else {
                    showAlert(alertContent: "Failed to get verifier or verifierId from userinfo")
                    return
                }
                verifier = verifierLocal
                verifierId = verifierIdLocal
                
                guard let postboxkey = finalKeyData.privKey else {
                    showAlert(alertContent:"Failed to get postboxkey")
                    return
                }
                
                guard let sessionData = userData.torusKey.sessionData else {
                    showAlert(alertContent:"Failed to get sessionData")
                    return
                }
                
                let sessionTokenData = sessionData.sessionTokenData
                
                signatures = sessionTokenData.map { token in
                    return [  "data": Data(hex: token!.token).base64EncodedString(),
                              "sig": token!.signature ]
                }
                assert(signatures.isEmpty != true)
                
                guard let storage_layer = try? StorageLayer(
                    enable_logging: true,
                    host_url: "https://metadata.tor.us",
                    server_time_offset: 2
                ) else {
                    showAlert(alertContent: "Failed to create storage layer")
                    return
                }
                
                torusUtils = TorusUtils(
                    enableOneKey: true,
                    network: .sapphire(.SAPPHIRE_MAINNET), 
                    clientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ"
                )
                
                let nodeDetailsManager = NodeDetailManager(
                    network: .sapphire(.SAPPHIRE_MAINNET)
                )
                
                nodeDetails = try await nodeDetailsManager.getNodeDetails(
                    verifier: verifier, verifierID: verifierId
                )
                
                tssEndPoints = nodeDetails!.torusNodeTSSEndpoints
                
                
                guard let service_provider = try? ServiceProvider(
                    enable_logging: true,
                    postbox_key: postboxkey,
                    useTss: true,
                    verifier: verifier,
                    verifierId: verifierId,
                    nodeDetails: nodeDetails
                )
                        
                else {
                    showAlert(alertContent: "Failed to create service provider")
                    return
                }
                
                let rss_comm = try RssComm()
                guard let thresholdKeyLocal = try? ThresholdKey(
                    storage_layer: storage_layer,
                    service_provider: service_provider,
                    enable_logging: true,
                    manual_sync: false,
                    rss_comm: rss_comm
                ) else {
                    showAlert(alertContent: "Failed to create threshold key")
                    return
                }
                
                thresholdKey = thresholdKeyLocal
                
                guard let keyDetailsLocal = try? await thresholdKey.initialize(
                    never_initialize_new_key: false,
                    include_local_metadata_transitions: false
                ) else {
                    showAlert(alertContent: "Failed to get key details")
                    return
                }
                
                keyDetails = keyDetailsLocal
                
                totalShares = Int(keyDetails.total_shares)
                threshold = Int(keyDetails.threshold)
                requiredShares = Int(keyDetails.required_shares)
                
                DispatchQueue.main.async {
                    self.isTKeyInitialized.toggle()
                }
                
                
            } catch let error {
                throw error
            }
        }
    }
    
    private func refreshFactorPubs() async throws {
        do  {
            let tag = try TssModule.get_tss_tag(threshold_key: thresholdKey)
            let factorPubsLocal = try await TssModule.get_all_factor_pub(
                threshold_key: thresholdKey, tss_tag: tag
            )
            
            DispatchQueue.main.async {
                self.factorPubs = factorPubsLocal
            }
        } catch let error {
            throw error
        }
    }
    
    func reconstructWithSecurityQuestion(answer: String) {
        Task {
            do {
                let isValidAnswer = try await SecurityQuestionModule.input_share(
                    threshold_key: thresholdKey, answer: answer
                )
                
                if(!isValidAnswer) {
                    showAlert(alertContent: "Not a valid answer")
                    return
                }
                
                
                guard let reconstructionDetails = try? await thresholdKey.reconstruct()
                else {
                    showAlert(
                        alertContent:"Failed to reconstruct key with security question."
                    )
                    return
                }
                
                let factorKey = try recoverFactorFromSecurityAnswer(answer: answer)
                activeFactor = factorKey.hex
                
                try await prepareEthTssAccout(factorKey: factorKey.hex)
                try await refreshFactorPubs()
                
                DispatchQueue.main.async {
                    self.isAccounReady.toggle()
                }
            } catch let error {
                showAlert(alertContent: error.localizedDescription)
            }
        }
    }
    
    private func recoverFactorFromSecurityAnswer(answer: String) throws -> PrivateKey {
        
        do {
            let pubKey = try thresholdKey.get_key_details().pub_key.getPublicKey(
                format: .EllipticCompress
            )
            
            var pubKeyBytes = pubKey.bytes
            pubKeyBytes.append(contentsOf: answer.bytes)
            
            let hash = CryptoSwift.SHA3(variant: .keccak256
            ).callAsFunction(pubKeyBytes).toHexString()
            
            let privateKey = PrivateKey(hex: hash)
            return privateKey
        } catch let error {
            throw error
        }
    }
    
    func reconstructWithBackupFactor(backupFactor: String) {
        Task {
            do {
               let hex = try ShareSerializationModule.deserialize_share(
                    threshold_key: thresholdKey,
                    share: backupFactor,
                    format: "mnemonic"
                )
                let factorKey = PrivateKey.init(hex: hex)
                try await thresholdKey.input_factor_key(factorKey: factorKey.hex)
        
                guard (try? await thresholdKey.reconstruct()) != nil
                else {
                    showAlert(
                        alertContent:"Failed to reconstruct key with  backup factor"
                    )
                    return
                }
                
                activeFactor = factorKey.hex
                try await prepareEthTssAccout(factorKey: factorKey.hex)
                try await refreshFactorPubs()
                
                DispatchQueue.main.async {
                    self.isAccounReady.toggle()
                }
            } catch let error {
                showAlert(alertContent: error.localizedDescription)
            }
        }
    }
    
    func reconstructWithDeviceShare() {
        Task {
            
            let metadataPublicKey = try keyDetails.pub_key.getPublicKey(
                format: .EllipticCompress
            )
            
            guard let factorPub = UserDefaults.standard.string(
                forKey: metadataPublicKey
            ) else {
                showAlert(alertContent: "Failed to find device share.")
                return
            }
            
            var factorKey: String!
            
            do {
                factorKey = try KeychainInterface.fetch(key: factorPub)
                try await thresholdKey.input_factor_key(factorKey: factorKey)
                let pk = PrivateKey(hex: factorKey)
                activeFactor = factorKey
              
            } catch {
                showAlert(
                    alertContent: "Failed to find device share or Incorrect device share"
                )
                return
            }
            
            guard let reconstructionDetails = try? await thresholdKey.reconstruct() else {
                showAlert(
                    alertContent:"Failed to reconstruct key with available shares."
                )
                return
            }
            
            try await prepareEthTssAccout(
                factorKey: factorKey
            )
            
            try await refreshFactorPubs()
            
            DispatchQueue.main.async {
                self.isAccounReady.toggle()
            }
        }
    }
    
    func addSecurityQuestion(question: String, answer: String) {
        Task {
            do {
               
                if(question.isEmpty || answer.isEmpty) {
                    showAlert(alertContent: "Question and Answer cannot be empty.")
                    return
                }
                
                let privateKey = try recoverFactorFromSecurityAnswer(answer: answer)
                
                try await saveNewTSSFactor(newFactorKey: privateKey)
                
                
                _ = try await SecurityQuestionModule.generate_new_share(
                    threshold_key: thresholdKey,
                    questions: question,
                    answer: answer
                )
                
                DispatchQueue.main.async {
                    self.securityQuestion = question
                }
                
            } catch let error {
                print(error.localizedDescription)
                showAlert(alertContent: error.localizedDescription)
            }
        }
    }
    
    private func toggleIsLoaderVisible() {
        DispatchQueue.main.async {
            self.isLoaderVisible.toggle()
        }
    }
    
    func resetAccount() {
        Task {
            do {
                guard let finalKeyData = userData.torusKey.finalKeyData else {
                    showAlert(alertContent:"Failed to get public address from userinfo")
                    return
                }
                
                guard let postboxkey = finalKeyData.privKey else {
                    showAlert(alertContent: "Failed to get public address from userinfo")
                    return
                }
                
                let temp_storage_layer = try StorageLayer(
                    enable_logging: true,
                    host_url: "https://metadata.tor.us",
                    server_time_offset: 2
                )
                
                let temp_service_provider = try ServiceProvider(
                    enable_logging: true,
                    postbox_key: postboxkey
                )
                
                let temp_threshold_key = try ThresholdKey(
                    storage_layer: temp_storage_layer,
                    service_provider: temp_service_provider,
                    enable_logging: true,
                    manual_sync: false
                )
                
                try await temp_threshold_key.storage_layer_set_metadata(
                    private_key: postboxkey,
                    json: "{ \"message\": \"KEY_NOT_FOUND\" }"
                )
                
                
                showAlert(alertContent: "Account reset successful")
                DispatchQueue.main.async {
                    self.isReseted = true
                }
                
            } catch {
                showAlert(alertContent: "Reset failed")
            }
        }
    }
    
    func sendTransaction(onSend: @escaping (String?, String?) -> ()) {
        Task {
            do {
                let address = self.ethereumAccount.address
                let transaction = EthereumTransaction.init(
                    to: address,
                    data: Data.init(hex: "0x")
                )
                
                let gasLimit = try await self.ethereumClient.getGasLimit(
                    transaction: transaction
                )
                let gasPrice = try await self.ethereumClient.getGasPrice()
                let nonce = try await self.ethereumClient.getNonce(address: address)
                
                let finalTransaction = EthereumTransaction(
                    from: address,
                    to: address,
                    value: TorusWeb3Utils.toWei(ether: 0.001),
                    data: transaction.data,
                    nonce: nonce,
                    gasPrice: gasPrice,
                    gasLimit: gasLimit,
                    chainId: Int(self.ethereumClient.getChainId())
                )
                
                let hash = try await self.ethereumClient.sendRawTransaction(
                    transaction: finalTransaction,
                    ethTssAccount: ethereumAccount
                )
                
                onSend(hash, nil)
                
                
            } catch let error {
                print(error.localizedDescription)
                onSend(nil, error.localizedDescription)
            }
        }
    }
    
    func deleteFactor(deleteFactorPub: String) {
        Task {
            var deleteFactorKey: String!
            var tag: String!
            do {
                tag = try TssModule.get_tss_tag(threshold_key: thresholdKey)
                deleteFactorKey = try KeychainInterface.fetch(key: deleteFactorPub)
            } catch {
                showAlert(alertContent: "There is no extra factor key to be deleted")
                return
            }
            
            
            do {
                let deleteFactorPrivateKey = PrivateKey(hex: deleteFactorKey)
                
                let factorKey = activeFactor
                let sigs: [String] = try signatures.map { String(
                    decoding: try JSONSerialization.data(withJSONObject: $0), as: UTF8.self
                )}
                
                try await TssModule.delete_factor_pub(
                    threshold_key: thresholdKey,
                    tss_tag: tag,
                    factor_key: factorKey!,
                    auth_signatures: sigs,
                    delete_factor_pub: deleteFactorPrivateKey.toPublic(),
                    nodeDetails: nodeDetails!,
                    torusUtils: torusUtils!
                )
                
                try KeychainInterface.save(item: "", key: deleteFactorKey)
                try await refreshFactorPubs()
                
                showAlert(alertContent: "Deleted Factor Key :" + deleteFactorPub)

            } catch let error {
                showAlert(alertContent: error.localizedDescription)
            }
        }
    }
    
    func reconstructWithNewDeviceFactor() {
        Task {
            do {
                let factorKey = try PrivateKey.generate()
                try await _createDeviceFactor(factorKey: factorKey)
                guard (try? await thresholdKey.reconstruct()) != nil else {
                    showAlert(
                        alertContent: "Failed to reconstruct key. \(keyDetails.required_shares) more share(s) required."
                    )
                    
                    return
                }
                
                activeFactor = factorKey.hex
                
                try await prepareEthTssAccout(factorKey: factorKey.hex)
                
                try await refreshFactorPubs()
                
                DispatchQueue.main.async {
                    self.isAccounReady.toggle()
                }
                
            } catch let error {
                showAlert(alertContent: error.localizedDescription)
            }
        }
    }
    
    private func _createDeviceFactor(factorKey: PrivateKey) async throws {
        do {
            let factorPub = try factorKey.toPublic()
            
            let tssIndex = Int32(2)
            let defaultTag = "default"
            
            try await TssModule.create_tagged_tss_share(
                threshold_key: thresholdKey,
                tss_tag: defaultTag,
                deviceTssShare: nil,
                factorPub: factorPub,
                deviceTssIndex: tssIndex,
                nodeDetails: self.nodeDetails!,
                torusUtils: self.torusUtils!
            )
            
            
            _ = try await TssModule.get_tss_pub_key(
                threshold_key: thresholdKey, tss_tag: defaultTag
            )
            
            var shareIndexes = try thresholdKey.get_shares_indexes()
            shareIndexes.removeAll(where: {$0 == "1"})
            
            try TssModule.backup_share_with_factor_key(
                threshold_key: thresholdKey,
                shareIndex: shareIndexes[0],
                factorKey: factorKey.hex
            )
            
            let description = [
                "module": "Device Factor key",
                "tssTag": defaultTag,
                "tssShareIndex": tssIndex,
                "dateAdded": Date().timeIntervalSince1970
            ] as [String: Codable]
            
            let jsonStr = try factorDescription(dataObj: description)
            
            try await thresholdKey.add_share_description(
                key: factorPub,
                description: jsonStr
            )
            
            let metadataPublicKey = try keyDetails.pub_key.getPublicKey(
                format: .EllipticCompress
            )
            
            
            UserDefaults.standard.set(factorPub, forKey: metadataPublicKey)
            
            guard let _ = try? KeychainInterface.save(
                item: factorKey.hex,
                key: factorPub
            ) else {
                showAlert(alertContent: "Failed to save factor key")
                
                return
            }
        } catch let error {
            throw error
        }
    }
    
    func createNewTSSFactor() {
        Task {
            do {
                let newFactorKey = try PrivateKey.generate()
                try await saveNewTSSFactor(newFactorKey: newFactorKey)
                
            } catch {
                showAlert(alertContent: "Invalid Factor Key")
            }
        }
    }
    
    private func saveNewTSSFactor(newFactorKey: PrivateKey) async throws {
        do {
            let newFactorPub = try newFactorKey.toPublic()
            
            // Use exising device factor to generate tss share with
            // index 3 with new factor
            let factorKey = activeFactor!
            
            let shareIndex = try await TssModule.find_device_share_index(
                threshold_key: thresholdKey,
                factor_key: factorKey
            )
            
            try TssModule.backup_share_with_factor_key(
                threshold_key: thresholdKey,
                shareIndex: shareIndex,
                factorKey: newFactorKey.hex
            )
            
            // For now only tss index 2 and index 3 are supported.
            //
            // Index 2 is used device factor, and index 3 is used for
            // recovery factor.
            let tssShareIndex = Int32(3)
            let sigs: [String] = try signatures.map {String(
                decoding:
                    try JSONSerialization.data(withJSONObject: $0), as: UTF8.self
            )}
            
            let tag = try TssModule.get_tss_tag(threshold_key: thresholdKey)
            
            try await TssModule.add_factor_pub(
                threshold_key: thresholdKey,
                tss_tag: tag,
                factor_key: factorKey,
                auth_signatures: sigs,
                new_factor_pub: newFactorPub,
                new_tss_index: tssShareIndex,
                nodeDetails: nodeDetails!,
                torusUtils: torusUtils!
            )
            
            let saveNewFactorId = newFactorPub
            try KeychainInterface.save(item: newFactorKey.hex, key: saveNewFactorId)
            
            let description = [
                "module": "Manual Backup",
                "tssTag": tag,
                "tssShareIndex": tssShareIndex,
                "dateAdded": Date().timeIntervalSince1970
            ] as [String: Codable]
            
            let jsonStr = try factorDescription(dataObj: description)
            
            try await thresholdKey.add_share_description(
                key: newFactorPub,
                description: jsonStr
            )
            
            let mnemonic = try ShareSerializationModule.serialize_share(
                threshold_key: thresholdKey,
                share: newFactorKey.hex,
                format: "mnemonic"
            )
            
            UIPasteboard.general.string = mnemonic
            
            try await refreshFactorPubs()
        } catch let error {
            throw error
        }
    }
    
    func signMessage(onSigned: @escaping (_ signedMessage: String?, _ error: String?) -> ()){
        Task {
            do {
                toggleIsLoaderVisible()
                let signature = try ethereumAccount.sign(message: "Welcome to Web3Auth")
                toggleIsLoaderVisible()
                onSigned(signature.toHexString(), nil)
            } catch let error  {
                toggleIsLoaderVisible()
                showAlert(alertContent: error.localizedDescription)
                onSigned(nil, error.localizedDescription)
            }
        }
    }
    
    
    func factorDescription ( dataObj: [String: Codable]  ) throws -> String {
        let json = try JSONSerialization.data(withJSONObject: dataObj)
        guard let jsonStr = String(data: json, encoding: .utf8) else {
            throw "Invalid data structure"
        }
        return jsonStr
    }
    
    private func showAlert(alertContent: String) {
        DispatchQueue.main.async {
            self.alertContent = alertContent
            self.showAlert.toggle()
        }
    }
    
    private func prepareEthTssAccout(
        factorKey: String
    ) async throws {
        let tag = try TssModule.get_tss_tag(threshold_key: thresholdKey)
        let tssPublicKey = try await  TssModule.get_tss_pub_key(
            threshold_key: thresholdKey, tss_tag: tag
        )
        
        let keyPoint = try KeyPoint(address: tssPublicKey)
        
        address = try keyPoint.getPublicKey(
            format: .FullAddress
        )
        
        let nonce = try TssModule.get_tss_nonce(
            threshold_key: thresholdKey, tss_tag: tag
        )
        
        print(nonce.description)
        
        let (tssIndex, tssShare) = try await TssModule.get_tss_share(
            threshold_key: thresholdKey,
            tss_tag: tag,
            factorKey: factorKey
        )
        
        let tssPublicAddressInfo = try await TssModule.get_dkg_pub_key(
            threshold_key: thresholdKey,
            tssTag: tag,
            nonce: nonce.description,
            nodeDetails: nodeDetails!,
            torusUtils: torusUtils!
        )
        
        
        let sigs: [String] = try signatures.map { String(
            decoding: try JSONSerialization.data(
                withJSONObject: $0
            ), as: UTF8.self)
        }
        
        let fullAddress = try keyPoint.getPublicKey(format: .FullAddress)
        
        let ethTssAccountParams = EthTssAccountParams(
            publicKey: fullAddress,
            factorKey: factorKey,
            tssNonce: nonce,
            tssShare: tssShare,
            tssIndex: tssIndex,
            selectedTag: tag,
            verifier: verifier,
            verifierID: verifierId,
            nodeIndexes: tssPublicAddressInfo.nodeIndexes.sorted(),
            tssEndpoints: tssEndPoints,
            authSigs: sigs
        )
        
        ethereumAccount = EthereumTssAccount(
            params: ethTssAccountParams
        )
        
        address = ethereumAccount.address.asString()
        print("Public Address: \(String(describing: address))")
    }
}
