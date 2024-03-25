//
//  ThresholdKeyViewModel.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import Foundation
import CustomAuth
import tkey_pkg
import TorusUtils
import FetchNodeDetails
import CommonSources

class ThresholdKeyViewModel: ObservableObject {
    var userData: TorusKeyData
    
    init(userData: TorusKeyData) {
        self.userData = userData
    }
    
    @Published var isAccounReady: Bool = false
    @Published var showAlert: Bool = false
    
    var verifier: String!
    var verifierId: String!
    var signatures: [[String: String]]!
    var torusUtils: TorusUtils!
    var nodeDetails: AllNodeDetailsModel!
    var tssEndPoints: Array<String>!
    var thresholdKey: ThresholdKey!
    var totalShares: Int!
    var threshold: Int!
    var deviceFactorPub: String!
    
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
                    network: .sapphire(.SAPPHIRE_MAINNET)
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

                guard let key_details = try? await thresholdKey.initialize(
                    never_initialize_new_key: false,
                    include_local_metadata_transitions: false
                ) else {
                    showAlert(alertContent: "Failed to get key details")
                    return
                }

                totalShares = Int(key_details.total_shares)
                threshold = Int(key_details.threshold)
                print(totalShares)
                print(threshold)
                print(key_details.required_shares)

                // public key of the metadatakey
                let metadataPublicKey = try key_details.pub_key.getPublicKey(
                    format: .EllipticCompress
                )
                
                if key_details.required_shares > 0 {
                    // exising user
                    let allTags = try thresholdKey.get_all_tss_tags()
                    print(allTags)
                    let tag = "default" // allTags[0]
                    _ = metadataPublicKey

                    guard let factorPub = UserDefaults.standard.string(
                        forKey: metadataPublicKey
                    ) else {
                         alertContent = "Failed to find device share."
                         showAlert = true
                         return
                     }

                    do {
                        deviceFactorPub = factorPub
                        let factorKey = try KeychainInterface.fetch(key: factorPub)
                        try await thresholdKey.input_factor_key(factorKey: factorKey)
                        let pk = PrivateKey(hex: factorKey)
                        deviceFactorPub = try pk.toPublic()

                    } catch {
                        alertContent = "Failed to find device share or Incorrect device share"
                        showAlert = true
                        return
                    }

                    guard let reconstructionDetails = try? await thresholdKey.reconstruct() else {

                        alertContent = "Failed to reconstruct key with available shares."
                        showAlert = true
                        return
                    }

                    _ = reconstructionDetails.key
                    // check if default in all tags else ??
                    _ = try await TssModule.get_tss_pub_key(
                        threshold_key: thresholdKey, tss_tag: tag
                    )

                    let defaultTssShareDescription = try thresholdKey.get_share_descriptions()
                    _ = "\(defaultTssShareDescription)"
                    print(defaultTssShareDescription)
                } else {
                    // new user
                    guard (try? await thresholdKey.reconstruct()) != nil else {
                        alertContent = "Failed to reconstruct key. \(key_details.required_shares) more share(s) required. If you have security question share, we suggest you to enter security question PW to recover your account"
                        
                        showAlert = true
                      
                        return
                    }

                    // TSS Module Initialize - create default tag
                    // generate factor key
                    let factorKey = try PrivateKey.generate()
                    // derive factor pub
                    let factorPub = try factorKey.toPublic()
                    deviceFactorPub = factorPub
                    // use input to create tag tss share
                    let tssIndex = Int32(2)
                    let defaultTag = "default"
                    try await TssModule.create_tagged_tss_share(threshold_key: thresholdKey, tss_tag: defaultTag, deviceTssShare: nil, factorPub: factorPub, deviceTssIndex: tssIndex, nodeDetails: self.nodeDetails!, torusUtils: self.torusUtils!)

                    _ = try await TssModule.get_tss_pub_key(
                        threshold_key: thresholdKey, tss_tag: defaultTag
                    )

                    // finding device share index
                    var shareIndexes = try thresholdKey.get_shares_indexes()
                    shareIndexes.removeAll(where: {$0 == "1"})

                    // backup metadata share using factorKey
                    try TssModule.backup_share_with_factor_key(threshold_key: thresholdKey, shareIndex: shareIndexes[0], factorKey: factorKey.hex)
                    let description = [
                        "module": "Device Factor key",
                        "tssTag": defaultTag,
                        "tssShareIndex": tssIndex,
                        "dateAdded": Date().timeIntervalSince1970
                    ] as [String: Codable]
                    let jsonStr = try factorDescription(dataObj: description)

                    try await thresholdKey.add_share_description(key: factorPub, description: jsonStr )

                    // point metadata pubkey to factorPub
                    UserDefaults.standard.set(factorPub, forKey: metadataPublicKey)

                    // save factor key in keychain using factorPub ( this factor key should be saved in any where that is accessable by the device)
                    guard let _ = try? KeychainInterface.save(item: factorKey.hex, key: factorPub) else {
                        alertContent = "Failed to save factor key"
                       
                        showAlert = true
                      
                        return
                    }

                    guard let reconstructionDetails = try? await thresholdKey.reconstruct() else {
                        alertContent = "Failed to reconstruct key. \(key_details.required_shares) more share(s) required."
                       
                        showAlert = true
                        return
                    }

                    _ = reconstructionDetails.key
                   
                }
                let defaultTssShareDescription = try thresholdKey.get_share_descriptions()
                let metadataDescription = "\(defaultTssShareDescription)"
                print(metadataDescription)
            } catch let error {
                throw error
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
}
