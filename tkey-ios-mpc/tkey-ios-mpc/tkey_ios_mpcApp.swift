//
//  tkey_ios_mpcApp.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import SwiftUI

@main
struct tkey_ios_mpcApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView(customAuthViewModel: CustomAuthViewModel())
        }
    }
}
