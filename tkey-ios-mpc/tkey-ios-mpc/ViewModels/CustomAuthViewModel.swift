//
//  ViewModel.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import Foundation
import CustomAuth

class CustomAuthViewModel: ObservableObject {
    var customAuth: CustomAuth!
    var torusKeyDetails: TorusKeyData!
    
    @Published var isLoggedIn: Bool = false
    
    func intialize() {
        Task {
            let subVerifierDetails = SubVerifierDetails(
                loginType: .web,
                loginProvider: .google,
                clientId: "519228911939-cri01h55lsjbsia1k7ll6qpalrus75ps.apps.googleusercontent.com",
                verifier: "w3a-google-demo",
                redirectURL: "tdsdk://tdsdk/oauthCallback",
                browserRedirectURL: "https://scripts.toruswallet.io/redirect.html"
                
            )
            customAuth = CustomAuth.init(
                web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
                aggregateVerifierType: .singleLogin,
                aggregateVerifier: "w3a-google-demo",
                subVerifierDetails: [subVerifierDetails],
                network: .sapphire(.SAPPHIRE_MAINNET)
            )
        }
    }
    
    func login()  {
        Task {
            do {
                torusKeyDetails = try await customAuth.triggerLogin()
                DispatchQueue.main.async {
                    self.isLoggedIn.toggle()
                }
            } catch let error {
                print(error)
            }
        }
    }
}
