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
        ZStack{
            List {
                
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
                            Text(hash!)
                        }
                    }
                )
                
                Section(
                    header: Text("Other TSS Factors"),
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
                    header: Text("TSS Operations"),
                    content: {
                        Button(
                            action: {
                                thresholdKeyViewModel.createNewTSSFactor()
                            },
                            label: {
                                Text("Create new TSS Factor")
                            }
                        )
                       
                        Text("Security Question")
                        
                        TextField(
                            "Your security question",
                            text: $question
                        )
                        
                        Text("Security Answer")
                        
                        TextField(
                            "Your security Answer",
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
                HStack {
                    ProgressView()
                    Text("Processing...")
                }
            }
        }.alert(isPresented: $thresholdKeyViewModel.showAlert, content: {
            Alert(title: Text(thresholdKeyViewModel.alertContent))

        })
    }
}
