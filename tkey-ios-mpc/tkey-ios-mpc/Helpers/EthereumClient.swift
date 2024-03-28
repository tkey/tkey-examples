//
//  EthereumClient.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 27/03/24.
//

import Foundation
import web3
import BigInt
import Web3SwiftMpcProvider

struct EthereumClient {
    let web3Client: EthereumHttpClient!
    var networkId: String = "11155111"
    
    init() {
        self.web3Client = EthereumHttpClient(
            url: URL(string: "https://1rpc.io/sepolia")!,
            network: .fromString(networkId)
        )
    }
    
    func getNonce(address: EthereumAddress) async throws -> Int{
        do {
           let nonce = try await web3Client.eth_getTransactionCount(
                address: address, block: .Latest
            )
            return nonce + 1
        } catch let error {
            throw error
        }
    }
    
    func getGasPrice() async throws -> BigUInt {
        do {
            let gasPrice = try await web3Client.eth_gasPrice()
            return gasPrice
        } catch let error {
            throw error
        }
    }
    
    func getGasLimit(transaction: EthereumTransaction) async throws -> BigUInt {
        do {
            let gasLimit = try await web3Client.eth_estimateGas(transaction)
            return gasLimit
        } catch let error {
            throw error
        }
    }
    
    func sendRawTransaction(
        transaction: EthereumTransaction,
        ethTssAccount: EthereumTssAccount
    ) async throws -> String {
        do {
            let hash = try await web3Client.eth_sendRawTransaction(
                transaction,
                withAccount: ethTssAccount
            )
            
            return hash
        } catch let error {
            throw error
        }
    }
    
    func getChainId() -> String {
        return networkId
    }
}
