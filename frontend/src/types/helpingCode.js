 {/* Zip Code & Location
                        <div className="flex items-center gap-2">
                            {isEditMode ? (
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={zipCode}
                                        onChange={(e) => handleZipCodeInputChange(e.target.value)}
                                        placeholder="Enter zip code"
                                        className="h-9 px-3 py-1 text-base md:text-lg border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 max-w-[200px]"
                                        inputMode="numeric"
                                    />
                                    {isLoadingLocation && (
                                        <p className="text-xs text-muted-foreground mt-1">Loading location...</p>
                                    )}
                                    {zipCodeError && (
                                        <p className="text-xs text-destructive mt-1">{zipCodeError}</p>
                                    )}
                                    {locationDisplay && !isLoadingLocation && !zipCodeError && (
                                        <p className="text-xs text-green-600 mt-1">
                                            {locationDisplay}
                                        </p>
                                    )}
                                </div>
                            ) : locationDisplay ? (
                                <div className="flex items-center gap-1 text-base md:text-lg text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <span>{locationDisplay}</span>
                                </div>
                            ) : null}
                        </div> */}