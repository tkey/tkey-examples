//
//  ContentView.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import SwiftUI

struct ContentView: View {
    @StateObject var customAuthViewModel: CustomAuthViewModel
    
    var body: some View {
        NavigationView {
            if customAuthViewModel.isLoggedIn {
                HomeView(thresholdKeyViewMode: ThresholdKeyViewModel(
                    userData: customAuthViewModel.torusKeyDetails
                ))
            } else {
                LoginView(customAuthViewModel: customAuthViewModel)
            }
        }.onAppear{
            customAuthViewModel.intialize()
        }
    }
}

#Preview {
    ContentView(customAuthViewModel: CustomAuthViewModel())
}
