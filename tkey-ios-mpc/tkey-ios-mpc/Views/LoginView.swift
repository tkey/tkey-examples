//
//  LoginView.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import Foundation

import SwiftUI

struct LoginView: View {
    @StateObject var customAuthViewModel: CustomAuthViewModel
    
    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("tKey iOS MPC Demo").font(.title).multilineTextAlignment(.center)
            Button(action: {
                customAuthViewModel.login()
            }, label: {
                Text("Sign in with Google")
            }).buttonStyle(.bordered)
            Spacer()
        }.onAppear {
            customAuthViewModel.intialize()
        }
        
    }
}

#Preview {
    LoginView(customAuthViewModel: CustomAuthViewModel())
}
