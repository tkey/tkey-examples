//
//  ContentView.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import SwiftUI

struct ContentView: View {
    @StateObject var viewModel: ViewModel
    
    var body: some View {
        NavigationView {
            if viewModel.isLoggedIn {
                ThresholdKeyView(thresholdKeyViewModel: ThresholdKeyViewModel(
                    viewModel: viewModel
                ))
                
            } else {
                LoginView(viewModel: viewModel)
            }
        }
    }
}

#Preview {
    ContentView(viewModel: ViewModel())
}
