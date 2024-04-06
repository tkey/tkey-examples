//
//  ThresholdKeyView.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 26/03/24.
//

import Foundation
import SwiftUI

struct ThresholdKeyView: View {
    @StateObject var thresholdKeyViewModel: ThresholdKeyViewModel
    
    var body: some View {
        NavigationView {
            if(!thresholdKeyViewModel.isAccounReady) {
                if(!thresholdKeyViewModel.isTKeyInitialized) {
                    ProgressView()
                } else {
                    ReconstructTKeyOptions(
                        thresholdKeyViewModel: thresholdKeyViewModel
                    )
                }
            } else {
                HomeView(thresholdKeyViewModel: thresholdKeyViewModel)
            }
        }.onAppear {
            thresholdKeyViewModel.initialize()
        }
    }
}

struct ReconstructTKeyOptions: View {
    @StateObject var thresholdKeyViewModel: ThresholdKeyViewModel
    @State private var backupFactor: String = ""
    @State private var answer: String = ""
    
    var body: some View {
        let isNewUser: Bool = thresholdKeyViewModel.requiredShares < 1
        List {
            Section(
                header: Text("Threshold Details"),
                content:  {
                    Text("Threshold: \(thresholdKeyViewModel.threshold)")
                    Text("Total Shares: \(thresholdKeyViewModel.totalShares)")
                    Text("Required Shares: \(thresholdKeyViewModel.requiredShares)")
                    Text("New user: \(isNewUser.description)")
                    
                }
            )
            
            if(!isNewUser) {
                Section(
                    header: Text("Reconstruct Options"),
                    content: {
                        Button(action: {
                            thresholdKeyViewModel.reconstructWithDeviceShare()
                        }, label: {
                            Text("Recover with Device share")
                        })
                    }
                )
                
                Section(
                    header: Text("Recovery Options"),
                    content:  {
                        TextField(
                            "Backup Factor in Mnemonic",
                            text: $backupFactor
                        )
                        Button(
                            action: {
                                thresholdKeyViewModel.reconstructWithBackupFactor(
                                    backupFactor: backupFactor
                                )
                            },
                            label: {
                                Text("Recover with backup")
                            }
                        )
                        
                        TextField(
                            "Answer",
                            text: $answer
                        )
                        
                        Button(
                            action: {
                                thresholdKeyViewModel.reconstructWithSecurityQuestion(
                                    answer: answer
                                )
                            },
                            label: {
                                Text("Recover with Security Question")
                            }
                        )
                    }
                )
                
                Section(
                    header: Text("Reset"),
                    content: {
                        Button(action: {
                            thresholdKeyViewModel.resetAccount()
                        }, label: {
                            Text("Reset Account")
                        })
                    }
                )
            } else {
                Button(action: {
                    thresholdKeyViewModel.reconstructWithNewDeviceFactor()
                }, label: {
                    Text("Create Device share")
                })
            }
        }.alert(isPresented: $thresholdKeyViewModel.showAlert, content: {
            Alert(title: Text(thresholdKeyViewModel.alertContent))
        })
    }
}
