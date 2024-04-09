import Foundation
import CustomAuth

class LoginModel: ObservableObject {
    @Published var loggedIn: Bool = false
    @Published var isLoading = false
    @Published var navigationTitle: String = ""
    @Published var userData: [String: Any]!

    func setup() async {
        await MainActor.run(body: {
            isLoading = true
            navigationTitle = "Loading"
        })
        await MainActor.run(body: {
            if self.userData != nil {
                loggedIn = true
            }
            isLoading = false
            navigationTitle = loggedIn ? "UserInfo" : "SignIn"
        })
    }

    func loginWithFacebook() {
        Task {
            let sub = SubVerifierDetails(loginType: .web,
                                         loginProvider: .facebook,
                                         clientId: "1222658941886084",
                                         verifier: "web3auth-facebook-example",
                                         redirectURL: "tdsdk://tdsdk/oauthCallback",
                                         browserRedirectURL: "https://scripts.toruswallet.io/redirect.html")
            let tdsdk = CustomAuth(aggregateVerifierType: .singleLogin, aggregateVerifier: "web3auth-facebook-example", subVerifierDetails: [sub], network: .TESTNET)
            do {
                let data = try await tdsdk.triggerLogin()
                await MainActor.run(body: {
                    self.userData = data
                    loggedIn = true
                })
            }
            catch {
                print("Unexpected error: \(error).")                
            }
        }
    }
    
    func loginWithGoogle() {
        Task {
            let sub = SubVerifierDetails(loginType: .web,
                                         loginProvider: .google,
                                         clientId: "774338308167-q463s7kpvja16l4l0kko3nb925ikds2p.apps.googleusercontent.com",
                                         verifier: "web3auth-google-example",
                                         redirectURL: "tdsdk://tdsdk/oauthCallback",
                                         browserRedirectURL: "https://scripts.toruswallet.io/redirect.html")
            let tdsdk = CustomAuth(aggregateVerifierType: .singleLogin, aggregateVerifier: "web3auth-google-example", subVerifierDetails: [sub], network: .TESTNET)
            do {
                let data = try await tdsdk.triggerLogin()
                await MainActor.run(body: {
                    self.userData = data
                    loggedIn = true
                })
            }
            catch {
                print(error)
            }
        }
    }

}
