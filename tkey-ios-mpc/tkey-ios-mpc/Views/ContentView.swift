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
                ThresholdKeyView(thresholdKeyViewModel: ThresholdKeyViewModel(
                    customAuthViewModel: customAuthViewModel
                ))
                
            } else {
                LoginView(customAuthViewModel: customAuthViewModel)
            }
        }
    }
}

#Preview {
    ContentView(customAuthViewModel: CustomAuthViewModel())
}
