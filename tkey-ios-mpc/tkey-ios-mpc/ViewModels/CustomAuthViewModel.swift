//
//  ViewModel.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import Foundation
import SingleFactorAuth
import FirebaseAuth
import GoogleSignIn
import FirebaseCore

class CustomAuthViewModel: ObservableObject {
//    var customAuth: CustomAuth!
    var torusSFAKey: TorusSFAKey!
    var singleFactorAuth: SingleFactorAuth!
    
    @Published var isLoggedIn: Bool = false
    
    func intialize() {
        Task {
            let singleFactorAuthArgs = SingleFactorAuthArgs(network: .sapphire(.SAPPHIRE_MAINNET))
            singleFactorAuth = SingleFactorAuth(singleFactorAuthArgs: singleFactorAuthArgs)
//            let subVerifierDetails = SubVerifierDetails(
//                loginType: .web,
//                loginProvider: .google,
//                clientId: "519228911939-cri01h55lsjbsia1k7ll6qpalrus75ps.apps.googleusercontent.com",
//                verifier: "w3a-google-demo",
//                redirectURL: "tdsdk://tdsdk/oauthCallback",
//                browserRedirectURL: "https://scripts.toruswallet.io/redirect.html"
//                
//            )
//            customAuth = CustomAuth.init(
//                aggregateVerifierType: .singleLogin, 
//                aggregateVerifier: "w3a-google-demo",
//                subVerifierDetails: [subVerifierDetails],
//                network: .sapphire(.SAPPHIRE_MAINNET)
//            )
        }
    }
    
    func login() {
        guard let clientID = FirebaseApp.app()?.options.clientID else { return }
        
        
        let configuration = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = configuration
        
       
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
        guard let rootViewController = windowScene.windows.first?.rootViewController else { return }
        
       
        GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController.presentedViewController!) { [unowned self] user, error in
            if(user != nil) {
                authenticateUser(for: user!, with: error)
            } else {
                return
            }
        }
    }
    
    private func authenticateUser(for user: GIDSignInResult?, with error: Error?) {
      if let error = error {
        print(error.localizedDescription)
        return
      }
      
      guard let idToken = user?.user.idToken else { return }
        guard let accessToken = user?.user.accessToken else {return}
      
        let credential = GoogleAuthProvider.credential(withIDToken: idToken.tokenString, accessToken: accessToken.tokenString)
      
      Auth.auth().signIn(with: credential) { [unowned self] (_, error) in
        if let error = error {
          print(error.localizedDescription)
        } else {
            self.isLoggedIn.toggle()
        }
      }
    }


    
    func loginWithSFA()  {
        Task {
            do {
//                try await singleFactorAuth.getKey(
//                    loginParams: LoginParams(
//                    verifier: <#T##String#>, 
//                    verifierId: <#T##String#>,
//                    idToken: <#T##String#>
//                    )
//                )
                torusKeyDetails = try await singleFactorAuth.
                DispatchQueue.main.async {
                    self.isLoggedIn.toggle()
                }
            } catch let error {
                print(error)
            }
        }
    }
}
