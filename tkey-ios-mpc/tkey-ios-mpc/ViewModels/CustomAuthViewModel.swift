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
import TorusUtils

class CustomAuthViewModel: ObservableObject {
    var torusSFAKey: TorusKey!
    var singleFactorAuth: SingleFactorAuth!
    var authDataResult: AuthDataResult!
    
    @Published var isLoggedIn: Bool = false
    
    func intialize() {
        Task {
            let singleFactorAuthArgs = SingleFactorAuthArgs(
                web3AuthClientId: "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ",
                network: .SAPPHIRE_MAINNET
            )
            singleFactorAuth = SingleFactorAuth(singleFactorAuthArgs: singleFactorAuthArgs)
        }
    }
    
    func login() {
        guard let clientID = FirebaseApp.app()?.options.clientID else { return }
        
        
        let configuration = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = configuration
        
       
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
            
       
        GIDSignIn.sharedInstance.signIn(withPresenting: windowScene.keyWindow!.rootViewController!) { [unowned self] user, error in
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

      Auth.auth().signIn(with: credential) { [unowned self] (result, error) in
        if let error = error {
          print(error.localizedDescription)
        } else {
            authDataResult = result!
            loginWithSFA()
        }
      }
    }


    
    func loginWithSFA()  {
        Task {
            do {
                torusSFAKey = try await singleFactorAuth.getTorusKey(
                    loginParams: LoginParams(
                    verifier: "w3a-firebase-demo",
                    verifierId: authDataResult.user.uid,
                    idToken: try authDataResult.user.getIDToken()
                    )
                )
                
                DispatchQueue.main.async {
                    self.isLoggedIn.toggle()
                }
            } catch let error {
                print(error)
            }
        }
    }
}
