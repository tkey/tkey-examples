//
//  HomeView.swift
//  tkey-ios-mpc
//
//  Created by Ayush B on 22/03/24.
//

import SwiftUI

struct HomeView: View {
    @StateObject var thresholdKeyViewMode: ThresholdKeyViewModel
    
    var body: some View {
        Text(/*@START_MENU_TOKEN@*/"Hello, World!"/*@END_MENU_TOKEN@*/).onAppear(perform: {
            thresholdKeyViewMode.initialize()
        })
    }
}
