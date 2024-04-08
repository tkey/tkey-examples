//
//  HomeView.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import SwiftUI

struct HomeView: View {
    @StateObject var thresholdKeyViewModel: ThresholdKeyViewModel
    @State var signedMessage: String?
    @State var hash: String?
    
    @State private var answer: String = ""
    @State private var question: String = ""
    
    var body: some View {
        let address = thresholdKeyViewModel.address
        NavigationView{
            ZStack {
                Form {
                    Section(
                        header: Text("Public Address"),
                        content: {
                            Button(
                                action: {
                                    UIPasteboard.general.string = address
                                    thresholdKeyViewModel.showAlert = true
                                    thresholdKeyViewModel.alertContent = "Address copied to clipbaord!"
                                }, label: {
                                    Text(address!)
                                })
                        }
                    )
                    Section(
                        header: Text("Chain interactions"),
                        content: {
                            Button(
                                action: {
                                    thresholdKeyViewModel.signMessage{
                                        signedMessage,error in
                                        self.signedMessage = signedMessage
                                    }
                                },
                                label: {
                                    Text("Sign Message")
                                }
                            )
                            
                            if(signedMessage != nil) {
                                Text(signedMessage!)
                            }
                            
                            
                            Button(
                                action: {
                                    thresholdKeyViewModel.sendTransaction {
                                        hash, error  in
                                        self.hash = hash
                                    }
                                },
                                label: {
                                    Text("Send 0.001 ETH")
                                }
                            )
                            
                            
                            if(hash != nil) {
                                Link(
                                    hash!,
                                    destination: URL(
                                        string: "https://sepolia.etherscan.io/tx/\(hash!)"
                                    )!
                                ).underline()
                            }
                            
                            Text("The sample uses Eth Sepolia, you can choose any EVM network of your choice. Send 0.001 ETH will perform self transfer of ETH. You'll need to have Sepolia faucet to perform transaction.").font(.caption)
                        }
                    )
                    
                    Section(
                        header: Text("TSS Factors PubKey"),
                        content: {
                            let areOtherFactorsPresent = thresholdKeyViewModel.factorPubs.count > 0
                            if(areOtherFactorsPresent) {
                                ForEach(Array(thresholdKeyViewModel.factorPubs), id: \.self) { factorPub in
                                    HStack(
                                        alignment: .top,
                                        spacing: 24,
                                        content: {
                                            Text(factorPub)
                                            Button(action: {
                                                withAnimation {
                                                    thresholdKeyViewModel.deleteFactor(
                                                        deleteFactorPub: factorPub
                                                    )
                                                }
                                            }) {
                                                Label("",systemImage: "trash")
                                            }
                                        })
                                }
                            } else {
                                Text("Only device factor found. Please create other TSS factor.")
                            }
                        }
                    )
                    
                    Section(
                        header: Text("Tss Module"),
                        content: {
                            Button(
                                action: {
                                    thresholdKeyViewModel.createNewTSSFactor()
                                },
                                label: {
                                    Text("Create new TSS Factor")
                                }
                            )
                        }
                    )
                    
                    Section(
                        header: Text("Security Question Module"),
                        content: {
                            
                            TextField(
                                "Enter your security question",
                                text: $question
                            )
                            
                            
                            TextField(
                                "Enter your security Answer",
                                text: $answer
                            )
                            
                            Button(
                                action: {
                                    thresholdKeyViewModel.addSecurityQuestion(
                                        question: question,
                                        answer: answer
                                    )
                                },
                                label: {
                                    Text("Add security question")
                                }
                            )
                        }
                    )
                }.blur(radius: thresholdKeyViewModel.isLoaderVisible ? 15 : 0)
                
                if(thresholdKeyViewModel.isLoaderVisible) {
                    HStack(
                        spacing: 8
                    ) {
                        ProgressView()
                        Text("Processing...")
                    }
                }
            }
        }.alert(isPresented: $thresholdKeyViewModel.showAlert, content: {
            Alert(title: Text(thresholdKeyViewModel.alertContent))
            
        })
    }
}
