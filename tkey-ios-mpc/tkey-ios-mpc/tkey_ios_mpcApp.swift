//
//  tkey_ios_mpcApp.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import SwiftUI
import FirebaseCore

extension tkey_ios_mpcApp {
  private func setupAuthentication() {
    FirebaseApp.configure()
  }
}

@main
struct tkey_ios_mpcApp: App {
    init() {
       setupAuthentication()
     }
    
    var body: some Scene {
        WindowGroup {
            ContentView(customAuthViewModel: CustomAuthViewModel())
        }
    }
}
